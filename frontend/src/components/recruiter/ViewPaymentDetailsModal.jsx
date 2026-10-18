import React, { useState } from 'react';
import { X, CheckCircle2, Copy, Check, Calendar, CreditCard, Building2, Hash, Clock, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const ViewPaymentDetailsModal = ({ payment, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !payment) return null;

  const job = payment.jobId || {};
  const isPaid = payment.status === 'PAID' || payment.status === 'COMPLETED';
  const isProcessing = payment.status === 'PROCESSING';
  const isRejected = payment.status === 'REJECTED';
  const isPending = !isPaid && !isProcessing && !isRejected;
  const hasSubmitted = isPaid || isProcessing;

  const utr = payment.utrNumber || payment.utr || payment.recruiterPaymentUTR || 'N/A';
  const amount = payment.amount || payment.recruiterPaymentAmount || 0;
  const paymentDate = payment.paymentDate || payment.recruiterPaymentDate || payment.updatedAt;
  const paymentMethod = payment.paymentMethod || payment.recruiterPaymentMethod || 'UPI';
  const perPersonRate = payment.perPersonRate || job.recruiterRequestedRate || job.offeredAmountPerPerson || job.recruiterProposedPayment || (payment.verifiedAttendeesCount > 0 ? payment.amount / payment.verifiedAttendeesCount : 0);
  const attendees = payment.verifiedAttendeesCount ?? 0;

  const copyUTR = () => {
    if (utr && utr !== 'N/A') {
      navigator.clipboard.writeText(utr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isPaid
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : isProcessing
                ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                : isRejected
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {isPaid ? <CheckCircle2 className="w-5 h-5" /> : isProcessing ? <Clock className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                isPaid
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : isProcessing
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : isRejected
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isPaid ? 'Payment Paid ✓' : isProcessing ? 'In Review (Processing)' : isRejected ? 'Rejected' : 'Payment Pending'}
              </span>
              <h3 className="text-lg font-extrabold text-white mt-1">Payment to JobbyHop Admin</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Amount Badge Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isPaid ? 'Total Amount Paid' : isProcessing ? 'Amount Submitted (In Review)' : 'Amount Due to Admin'}
              </p>
              <h2 className="text-3xl font-black text-white mt-1">{formatCurrency(amount)}</h2>
              {attendees > 0 && perPersonRate > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {attendees} attendee{attendees === 1 ? '' : 's'} × {formatCurrency(perPersonRate)}
                </p>
              )}
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
              isPaid
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : isProcessing
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                : isRejected
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              {isPaid ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> PAID ✓
                </>
              ) : isProcessing ? (
                <>
                  <Clock className="w-4 h-4" /> IN REVIEW
                </>
              ) : isRejected ? (
                <>
                  <X className="w-4 h-4" /> REJECTED
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" /> PAYMENT PENDING
                </>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-3">
            {/* Event Name */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" /> Related Job / Event
              </span>
              <span className="text-xs font-bold text-white max-w-[60%] truncate text-right">
                {job.title || 'Event Posting'}
              </span>
            </div>

            {/* Rate per Person */}
            {perPersonRate > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" /> Rate per Person
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {formatCurrency(perPersonRate)} <span className="text-[10px] text-amber-500/60 font-normal">/ person</span>
                </span>
              </div>
            )}

            {/* Verified Attendees */}
            {attendees > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" /> Verified Attendees
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  {attendees} worker{attendees === 1 ? '' : 's'}
                </span>
              </div>
            )}

            {/* UTR / Transaction Reference */}
            {hasSubmitted && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-400" /> UTR / Transaction No.
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-300">{utr}</span>
                  <button
                    onClick={copyUTR}
                    title="Copy UTR"
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Method */}
            {hasSubmitted && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" /> Payment Method
                </span>
                <span className="text-xs font-bold text-white uppercase">{paymentMethod}</span>
              </div>
            )}

            {/* Payment Date */}
            {hasSubmitted && paymentDate && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" /> Payment Date
                </span>
                <span className="text-xs font-bold text-white">{formatDate(paymentDate)}</span>
              </div>
            )}

            {/* Admin notes if rejected */}
            {isRejected && payment.adminNotes && (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs space-y-1">
                <span className="text-rose-400 font-bold block">Admin Feedback / Rejection Reason:</span>
                <p className="text-rose-200">{payment.adminNotes}</p>
              </div>
            )}

            {/* Event Details if available */}
            {job.location && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" /> Event Location
                </span>
                <span className="text-xs text-slate-300 max-w-[60%] truncate text-right">
                  {typeof job.location === 'object' ? job.location.address : job.location}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPaymentDetailsModal;
