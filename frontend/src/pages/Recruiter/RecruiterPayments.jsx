import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import recruiterPaymentService from '../../services/recruiterPaymentService';
import PayAdminModal from '../../components/recruiter/PayAdminModal';
import ViewPaymentDetailsModal from '../../components/recruiter/ViewPaymentDetailsModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Hash,
  ArrowRight,
  WalletCards,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const RecruiterPayments = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayPayment, setSelectedPayPayment] = useState(null);
  const [selectedViewPayment, setSelectedViewPayment] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await recruiterPaymentService.getMyPayments();
      if (res?.success) {
        setPayments(res.payments || res.data || []);
        setSummary(res.summary || null);
      }
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?._id) fetchPayments();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading recruiter payments..." />;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="glass-card p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-950">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/20">
            <WalletCards className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-3 py-0.5 rounded-full border border-purple-500/30">
              Recruiter to Admin
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-1">Recruiter Payments</h1>
            <p className="text-xs text-slate-400">
              Platform fees payable to JobbyHop Admin for approved event requests.
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
            <div className="text-center">
              <p className="text-[10px] uppercase text-amber-400/80 font-bold mb-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Pending
              </p>
              <p className="text-lg font-extrabold text-amber-400">{formatCurrency(summary.pendingAmount || 0)}</p>
              <span className="text-[10px] text-slate-500">{summary.pendingCount || 0} event(s)</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-purple-400/80 font-bold mb-1 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" /> In Review
              </p>
              <p className="text-lg font-extrabold text-purple-400">{formatCurrency(summary.processingAmount || 0)}</p>
              <span className="text-[10px] text-slate-500">{summary.processingCount || 0} event(s)</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-emerald-400/80 font-bold mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Paid
              </p>
              <p className="text-lg font-extrabold text-emerald-400">{formatCurrency(summary.paidAmount || 0)}</p>
              <span className="text-[10px] text-slate-500">{summary.paidCount || 0} event(s)</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-rose-400/80 font-bold mb-1 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" /> Rejected
              </p>
              <p className="text-lg font-extrabold text-rose-400">{formatCurrency(summary.rejectedAmount || 0)}</p>
              <span className="text-[10px] text-slate-500">{summary.rejectedCount || 0} event(s)</span>
            </div>
          </div>
        )}
      </div>

      {/* Payment Records */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-white">Payment Records</h2>

        {payments.length === 0 ? (
          <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-3 bg-slate-900/40">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No payment is currently due.</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              When your job / event postings are approved by JobbyHop Admin, payment requirements will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {payments.map((payment) => {
              const isPaid = payment.status === 'PAID';
              const isProcessing = payment.status === 'PROCESSING';
              const isRejected = payment.status === 'REJECTED';
              const hasSubmitted = isPaid || isProcessing;

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
                    isPaid
                      ? 'border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 shadow-lg shadow-emerald-950/10'
                      : isProcessing
                      ? 'border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20 shadow-lg shadow-purple-950/10'
                      : isRejected
                      ? 'border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20 shadow-lg shadow-rose-950/10'
                      : 'border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 shadow-lg shadow-amber-950/10'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Card Header */}
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
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isProcessing
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : isRejected
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isPaid ? (
                          <><CheckCircle2 className="w-3 h-3" /> PAID</>
                        ) : isProcessing ? (
                          <><RefreshCw className="w-3 h-3 animate-spin" /> IN REVIEW</>
                        ) : isRejected ? (
                          <><AlertCircle className="w-3 h-3" /> REJECTED</>
                        ) : (
                          <><Clock className="w-3 h-3" /> PENDING</>
                        )}
                      </span>
                    </div>

                    {/* Amount Block */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isPaid ? 'Total Amount Paid' : isProcessing ? 'Total Amount Submitted' : 'Total Amount Due'}
                        </span>
                        {attendees > 0 && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {attendees} attendee{attendees === 1 ? '' : 's'} × {formatCurrency(perPersonRate)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xl font-black ${
                          isPaid
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

                    {/* Event details & Rate */}
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Rate per Person:</span>
                        <span className="font-extrabold text-amber-400">
                          {formatCurrency(perPersonRate)} <span className="text-[10px] text-amber-500/60 font-normal">/ person</span>
                        </span>
                      </div>
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
                      {payment.verifiedAttendeesCount !== undefined && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Verified Attendees:</span>
                          <span className="font-semibold text-emerald-400">{payment.verifiedAttendeesCount} worker(s)</span>
                        </div>
                      )}
                    </div>

                    {/* UTR info (submitted state) */}
                    {hasSubmitted && (
                      <div
                        className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                          isPaid ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-purple-500/5 border-purple-500/20'
                        }`}
                      >
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
                            <CreditCard className="w-3 h-3 text-purple-400" /> Method:
                          </span>
                          <span className="font-semibold text-white uppercase">{payMethod}</span>
                        </div>
                      </div>
                    )}

                    {/* Rejection reason */}
                    {isRejected && payment.adminNotes && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                        <span className="font-bold text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Rejection Reason:
                        </span>
                        <p className="text-rose-200/90">{payment.adminNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
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

      {/* Modals */}
      <PayAdminModal
        payment={selectedPayPayment}
        isOpen={Boolean(selectedPayPayment)}
        onClose={() => setSelectedPayPayment(null)}
        onSuccess={() => fetchPayments()}
        showToast={showToast}
      />
      <ViewPaymentDetailsModal
        payment={selectedViewPayment}
        isOpen={Boolean(selectedViewPayment)}
        onClose={() => setSelectedViewPayment(null)}
      />
    </div>
  );
};

export default RecruiterPayments;
