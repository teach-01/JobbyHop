import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, Building2, QrCode, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import recruiterPaymentService from '../../services/recruiterPaymentService';

export const PayAdminModal = ({ payment, isOpen, onClose, onSuccess, showToast }) => {
  const [utr, setUtr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !payment) return null;

  const job = payment.jobId || {};
  const amountDue = payment.amount || 0;
  const attendeeCount = payment.verifiedAttendeesCount ?? (payment.verifiedCount || 0);
  const applicableRate = payment.perPersonRate || job.recruiterRequestedRate || job.offeredAmountPerPerson || job.recruiterProposedPayment || ((attendeeCount > 0 && amountDue > 0) ? (amountDue / attendeeCount) : 0);
  const canSubmit = amountDue > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Cannot submit payment: Payment amount must be greater than zero.');
      return;
    }

    const trimmedUtr = utr.trim();
    if (!trimmedUtr) {
      setError('Please enter a valid UTR / Transaction Reference number.');
      return;
    }

    if (trimmedUtr.length < 6 || trimmedUtr.length > 50) {
      setError('UTR / Transaction number must be between 6 and 50 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await recruiterPaymentService.submitPayment(payment._id, {
        utr: trimmedUtr,
        paymentMethod,
      });

      if (res.success) {
        if (showToast) {
          showToast('Payment details submitted successfully! Status is now Processing (In Review by Admin).', 'success');
        }
        if (onSuccess) {
          onSuccess(res.data);
        }
        onClose();
      } else {
        setError(res.message || 'Payment submission failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full">
                Recruiter → JobbyHop Admin
              </span>
              <h3 className="text-lg font-extrabold text-white mt-1">Submit Payment to Admin</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Event & Amount Due Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-slate-950 border border-purple-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-300 font-semibold">Event / Job Title:</span>
              <span className="text-xs font-bold text-white text-right max-w-[60%] truncate">
                {job.title || 'Event Posting'}
              </span>
            </div>
            {job.eventDate && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Event Date:</span>
                <span>{formatDate(job.eventDate)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Verified Attendees:</span>
              <span className="font-bold text-white">
                {attendeeCount} worker{attendeeCount === 1 ? '' : 's'} (Admin Verified PRESENT)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Your Rate (per person):</span>
              <span className="font-extrabold text-amber-400">
                {formatCurrency(applicableRate)} <span className="text-[10px] text-amber-500/70 font-normal">/ person</span>
              </span>
            </div>
            <div className="pt-3 border-t border-purple-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold text-slate-300 block">Total Calculated Payable:</span>
                {attendeeCount > 0 && (
                  <span className="text-[10px] text-slate-500">
                    {attendeeCount} attendee{attendeeCount === 1 ? '' : 's'} × {formatCurrency(applicableRate)}
                  </span>
                )}
              </div>
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                {formatCurrency(amountDue)}
              </span>
            </div>
          </div>

          {/* Zero Attendance Alert */}
          {!canSubmit && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold text-white">Attendance Verification Required</p>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  No eligible workers with verified PRESENT attendance found for this event. Attendance-based payment cannot be submitted with a positive payable amount.
                </p>
              </div>
            </div>
          )}

          {/* Payment Instructions */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Official Admin Payment Details</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Transfer the exact amount of <span className="font-bold text-white">{formatCurrency(amountDue)}</span> to JobbyHop Admin via UPI, then provide the transaction reference (UTR) below.
            </p>
            <div className="text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">ADMIN UPI ID</span>
                <span className="font-mono font-bold text-purple-300 select-all">aadish29@ibl</span>
              </div>
            </div>
          </div>

          {/* Error Callout */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Details Form */}
          <form id="recruiter-pay-admin-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Payment Method <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['UPI', 'Bank Transfer', 'Other'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      paymentMethod === method
                        ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                UTR / Transaction Reference Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => {
                  setUtr(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. 123456789012 or UPI Ref ID"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 font-mono focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Enter the reference number from your Google Pay, PhonePe, Paytm, or bank receipt.
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recruiter-pay-admin-form"
            disabled={submitting || !utr.trim() || !canSubmit}
            className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>Submitting Payment...</>
            ) : (
              <>
                Confirm & Submit Payment <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayAdminModal;
