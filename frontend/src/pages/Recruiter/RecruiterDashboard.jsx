import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { jobService } from '../../services/jobService';
import recruiterPaymentService from '../../services/recruiterPaymentService';
import StatCard from '../../components/common/StatCard';
import JobCard from '../../components/jobs/JobCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import PayAdminModal from '../../components/recruiter/PayAdminModal';
import ViewPaymentDetailsModal from '../../components/recruiter/ViewPaymentDetailsModal';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  AlertCircle,
  Calendar,
  IndianRupee,
  ArrowRight,
  CreditCard,
  Building2,
  Check,
  Hash,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const RecruiterDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Recruiter → Admin Payments State (Recruiter → JobbyHop Admin)
  const [adminPayments, setAdminPayments] = useState([]);
  const [adminPaymentSummary, setAdminPaymentSummary] = useState(null);
  const [selectedPayPayment, setSelectedPayPayment] = useState(null);
  const [selectedViewPayment, setSelectedViewPayment] = useState(null);

  const fetchDashboardData = async () => {
    if (user?._id) {
      const [jobsRes, adminPayRes] = await Promise.all([
        jobService.getRecruiterJobs({ limit: 1000 }),
        recruiterPaymentService.getMyPayments(),
      ]);

      if (jobsRes.success) {
        setJobs(jobsRes.data);
        if (jobsRes.stats) {
          setStats(jobsRes.stats);
        }
      }
      if (adminPayRes?.success) {
        setAdminPayments(adminPayRes.payments || adminPayRes.data || []);
        setAdminPaymentSummary(adminPayRes.summary || null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading recruiter portal..." />;

  const totalJobs = stats?.totalSubmitted ?? jobs.length;
  const pendingJobs = stats?.pendingReview ?? jobs.filter((j) => j.status === 'PENDING_REVIEW').length;
  const approvedJobs = stats?.approved ?? jobs.filter((j) => j.status === 'APPROVED').length;
  const rejectedJobs = stats?.rejected ?? jobs.filter((j) => j.status === 'REJECTED').length;
  const completedJobs = stats?.completed ?? jobs.filter((j) => j.status === 'COMPLETED').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-purple-500/10 text-purple-300 px-3 py-1 rounded-full border border-purple-500/20">
            Recruiter Portal
          </span>
          <h1 className="text-2xl font-extrabold text-white mt-2">
            Welcome back, {user?.profile?.companyName || user?.profile?.fullName || 'Recruiter'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your event job postings and track Admin approval statuses.
          </p>
        </div>
        <Link
          to="/recruiter/create-job"
          className="gradient-btn px-5 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Create New Job / Event
        </Link>
      </div>

      {/* Notice Callout */}
      <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-200 text-xs flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Centralized Admin Control Rule:</p>
          <p className="text-[11px] text-brand-300/80 mt-0.5">
            All submitted job posts undergo JobbyHop Admin review and payment approval before becoming visible to workers. Workers apply directly via Admin.
          </p>
        </div>
      </div>

      {/* Stat Cards Grid - Fully Clickable Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          icon={Briefcase}
          color="purple"
          to="/recruiter/submitted-events?status=all"
        />
        <StatCard
          title="Pending Review"
          value={pendingJobs}
          icon={Clock}
          color="amber"
          to="/recruiter/submitted-events?status=pending"
        />
        <StatCard
          title="Approved Jobs"
          value={approvedJobs}
          icon={CheckCircle2}
          color="emerald"
          to="/recruiter/submitted-events?status=approved"
        />
        <StatCard
          title="Rejected Jobs"
          value={rejectedJobs}
          icon={XCircle}
          color="rose"
          to="/recruiter/submitted-events?status=rejected"
        />
        <StatCard
          title="Completed Events"
          value={completedJobs}
          icon={Calendar}
          color="indigo"
          to="/recruiter/submitted-events?status=completed"
        />
      </div>

      {/* Financial Summary: Recruiter → Admin */}
      <div className="grid grid-cols-1 gap-6">
        {/* 1. PAYMENT TO JOBBYHOP ADMIN (Recruiter → Admin) */}
        <div className="glass-card p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-950 flex flex-col justify-between shadow-lg shadow-purple-950/20">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30 flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" /> Recruiter → Admin
              </span>
              {adminPaymentSummary?.pendingCount > 0 && (
                <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {adminPaymentSummary.pendingCount} Action Required
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <IndianRupee className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment to JobbyHop Admin</p>
                <h2 className="text-3xl font-black text-white">
                  {formatCurrency(adminPaymentSummary?.totalAmount || 0)}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 mb-4">
              <div>
                <p className="text-[10px] uppercase text-amber-400/80 font-bold mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Pending
                </p>
                <p className="text-base font-extrabold text-amber-400">
                  {formatCurrency(adminPaymentSummary?.pendingAmount || 0)}
                </p>
                <span className="text-[10px] text-slate-500">
                  {adminPaymentSummary?.pendingCount || 0} event{(adminPaymentSummary?.pendingCount || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase text-emerald-400/80 font-bold mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Paid / Verified
                </p>
                <p className="text-base font-extrabold text-emerald-400">
                  {formatCurrency((adminPaymentSummary?.paidAmount || 0) + (adminPaymentSummary?.completedAmount || 0))}
                </p>
                <span className="text-[10px] text-slate-500">
                  {(adminPaymentSummary?.paidCount || 0) + (adminPaymentSummary?.completedCount || 0)} event{((adminPaymentSummary?.paidCount || 0) + (adminPaymentSummary?.completedCount || 0)) === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
            Direct platform fee & escrow payable to JobbyHop Admin for approved event requests.
          </p>
        </div>
      </div>

      {/* DEDICATED SECTION: PAYMENT TO JOBBYHOP ADMIN */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">PAYMENT TO JOBBYHOP ADMIN</h2>
              <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                Recruiter → Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review event payment requirements and submit transaction UTR after transferring funds to Admin.
            </p>
          </div>
        </div>

        {adminPayments.length === 0 ? (
          <div className="glass-card p-8 rounded-3xl border border-slate-800 text-center space-y-3 bg-slate-900/40">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No payment is currently due.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              When your job / event postings are reviewed and approved by JobbyHop Admin, payment requirements and options to pay Admin will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminPayments.map((payment) => {
              const isPaid = payment.status === 'PAID';
              const isCompleted = payment.status === 'COMPLETED';
              const isProcessing = payment.status === 'PROCESSING';
              const isRejected = payment.status === 'REJECTED';
              const isPending = payment.status === 'PENDING';
              // hasSubmitted = recruiter already submitted UTR (in review or verified)
              const hasSubmitted = isPaid || isCompleted || isProcessing;

              const job = payment.jobId || {};
              const utrNumber = payment.utr || payment.utrNumber || payment.recruiterPaymentUTR;
              const payDate = payment.paymentDate || payment.recruiterPaymentDate;
              const payMethod = payment.paymentMethod || payment.recruiterPaymentMethod || 'UPI';
              const perPersonRate = payment.perPersonRate || job.recruiterRequestedRate || job.offeredAmountPerPerson || job.recruiterProposedPayment || (payment.verifiedAttendeesCount > 0 ? payment.amount / payment.verifiedAttendeesCount : 0);
              const attendees = payment.verifiedAttendeesCount ?? 0;

              return (
                <div
                  key={payment._id}
                  className={`glass-card p-6 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                    (isPaid || isCompleted)
                      ? 'border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 shadow-lg shadow-emerald-950/10'
                      : isProcessing
                      ? 'border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20 shadow-lg shadow-purple-950/10'
                      : isRejected
                      ? 'border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20 shadow-lg shadow-rose-950/10'
                      : 'border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 shadow-lg shadow-amber-950/10'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: Section Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          PAYMENT TO JOBBYHOP ADMIN
                        </span>
                        <h4 className="text-base font-extrabold text-white mt-0.5 truncate">
                          {job.title || 'Event Posting'}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1 ${
                          (isPaid || isCompleted)
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isProcessing
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : isRejected
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> PAID ✓
                          </>
                        ) : isCompleted ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> SUBMITTED ✓
                          </>
                        ) : isProcessing ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" /> IN REVIEW
                          </>
                        ) : isRejected ? (
                          <>
                            <AlertCircle className="w-3 h-3" /> REJECTED
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> PAYMENT PENDING
                          </>
                        )}
                      </span>
                    </div>

                    {/* Amount Block */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {(isPaid || isCompleted) ? 'Total Amount Paid' : isProcessing ? 'Total Amount Submitted' : 'Total Amount Due'}
                        </span>
                        {attendees > 0 && perPersonRate > 0 && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {attendees} attendee{attendees === 1 ? '' : 's'} × {formatCurrency(perPersonRate)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xl font-black ${
                          (isPaid || isCompleted)
                            ? 'text-emerald-400'
                            : isProcessing
                            ? 'text-purple-300'
                            : isRejected
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>

                    {/* For: Job/Event Title Details */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {perPersonRate > 0 && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Rate per Person:</span>
                          <span className="font-extrabold text-amber-400">
                            {formatCurrency(perPersonRate)} <span className="text-[10px] text-amber-500/60 font-normal">/ person</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Event Type:</span>
                        <span className="font-semibold text-white">{job.eventType || 'Event'}</span>
                      </div>
                      {job.eventDate && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Event Date:</span>
                          <span className="font-semibold text-white">{formatDate(job.eventDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* After Payment Submitted/Completed Information */}
                    {hasSubmitted && (
                      <div className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                        (isPaid || isCompleted)
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-purple-500/5 border-purple-500/20'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-purple-400" /> UTR / Transaction No:
                          </span>
                          <span className="font-mono font-bold text-purple-300 truncate max-w-[50%]">
                            {utrNumber || 'N/A'}
                          </span>
                        </div>
                        {payDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-purple-400" /> Payment Date:
                            </span>
                            <span className="font-semibold text-white">{formatDate(payDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-purple-400" /> Payment Method:
                          </span>
                          <span className="font-semibold text-white uppercase">{payMethod}</span>
                        </div>
                      </div>
                    )}

                    {/* Admin rejection reason */}
                    {isRejected && payment.adminNotes && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                        <span className="font-bold text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Rejection Reason:
                        </span>
                        <p className="text-rose-200/90">{payment.adminNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4 mt-4 border-t border-slate-800/80">
                    {hasSubmitted ? (
                      <button
                        onClick={() => setSelectedViewPayment(payment)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
                      >
                        VIEW PAYMENT DETAILS <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : isRejected ? (
                      <button
                        onClick={() => setSelectedPayPayment(payment)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                      >
                        <CreditCard className="w-4 h-4" /> RE-SUBMIT PAYMENT UTR
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedPayPayment(payment)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg gradient-btn shadow-purple-900/30"
                      >
                        <CreditCard className="w-4 h-4" /> PAY ADMIN
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Jobs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Job Postings</h2>
          <Link to="/recruiter/submitted-events" className="text-xs font-semibold text-brand-400 hover:underline">
            View All ({totalJobs}) →
          </Link>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title="No Jobs Created Yet"
            description="Post your first event request to recruit hostesses, ushers, security, or event coordinators."
            actionText="Create First Job"
            onAction={() => navigate('/recruiter/create-job')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.slice(0, 6).map((job) => (
              <JobCard
                key={job._id}
                job={job}
                onViewDetails={() => navigate(`/recruiter/submitted-events/${job._id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pay Admin Modal */}
      <PayAdminModal
        payment={selectedPayPayment}
        isOpen={Boolean(selectedPayPayment)}
        onClose={() => setSelectedPayPayment(null)}
        onSuccess={() => fetchDashboardData()}
        showToast={showToast}
      />

      {/* View Payment Details Modal */}
      <ViewPaymentDetailsModal
        payment={selectedViewPayment}
        isOpen={Boolean(selectedViewPayment)}
        onClose={() => setSelectedViewPayment(null)}
      />
    </div>
  );
};

export default RecruiterDashboard;
