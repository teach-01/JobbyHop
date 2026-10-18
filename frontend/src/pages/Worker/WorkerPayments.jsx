import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import paymentService from '../../services/paymentService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditCard, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

// Maps ?status= URL param (from dashboard cards) to internal filter keys
const URL_STATUS_MAP = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  ON_HOLD: 'ON_HOLD',
  FAILED: 'FAILED',
};

export const WorkerPayments = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Determine initial filter from URL param (e.g. from dashboard card navigation)
  const urlStatus = searchParams.get('status');
  const initialFilter = urlStatus && URL_STATUS_MAP[urlStatus] ? urlStatus : 'ALL';
  const [filter, setFilter] = useState(initialFilter);

  // Update filter when URL param changes (e.g. navigating from a different dashboard card)
  useEffect(() => {
    if (urlStatus && URL_STATUS_MAP[urlStatus]) {
      setFilter(urlStatus);
    } else if (!urlStatus) {
      setFilter('ALL');
    }
  }, [urlStatus]);

  useEffect(() => {
    const fetchPayments = async () => {
      if (user?._id) {
        const res = await paymentService.getWorkerPayments(user._id);
        if (res.success) {
          setPayments(res.data);
        }
      }
      setLoading(false);
    };
    fetchPayments();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading payment history..." />;

  const getStepCompleted = (status, stepIndex) => {
    if (status === 'PAID') return true;
    if (status === 'PROCESSING' && stepIndex <= 3) return true;
    if (status === 'PENDING' && stepIndex <= 2) return true;
    if (stepIndex === 1) return true;
    return false;
  };

  // Apply status filter
  const filteredPayments = payments.filter((p) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return p.status === 'PENDING' || p.status === 'PROCESSING';
    return p.status === filter;
  });

  const pendingCount = payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').length;
  const paidCount = payments.filter((p) => p.status === 'PAID').length;
  const onHoldCount = payments.filter((p) => p.status === 'ON_HOLD').length;
  const failedCount = payments.filter((p) => p.status === 'FAILED').length;

  const filterButtons = [
    { key: 'ALL', label: 'All', count: payments.length },
    { key: 'PENDING', label: 'Pending / Processing', count: pendingCount },
    { key: 'PAID', label: 'Paid', count: paidCount },
    { key: 'ON_HOLD', label: 'On Hold', count: onHoldCount },
    { key: 'FAILED', label: 'Failed', count: failedCount },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Earnings &amp; Payouts</h1>
          <p className="text-xs text-slate-400">Track verified shift earnings and 10–15 day payout progress.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
          <Clock className="w-4 h-4 text-purple-400" /> 10–15 Day Guarantee
        </div>
      </div>

      {/* Prominent Timeline Banner */}
      <div className="glass-card p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 to-slate-950 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" /> Official JobbyHop Payout Lifecycle Protocol
        </h3>
        <p className="text-xs text-purple-200/80">
          &quot;Payment is expected within 10–15 days from event completion date.&quot;
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Step 1</span>
            <span className="font-bold text-white">Event Completed</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-[10px] text-amber-500 uppercase block font-bold">Step 2</span>
            <span className="font-bold text-amber-300">Payment Pending</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-[10px] text-brand-400 uppercase block font-bold">Step 3</span>
            <span className="font-bold text-brand-300">Payment Processing</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
            <span className="text-[10px] text-emerald-400 uppercase block font-bold">Step 4</span>
            <span className="font-bold text-emerald-300">Paid to Bank / UPI</span>
          </div>
        </div>
      </div>

      {/* Status Filters — supports dashboard card deep-link via ?status= URL param */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {filterButtons.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <EmptyState
          title="No Payments Found"
          description={
            filter === 'ALL'
              ? 'Complete event shifts to earn guaranteed payouts.'
              : `No ${filter.toLowerCase()} payments found.`
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((p) => (
            <div key={p._id} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">{p.jobId?.title || 'Unknown Event'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Completed on: {formatDate(p.jobId?.eventDate)} • Expected Payout Date:{' '}
                    <span className="text-purple-300 font-bold">{formatDate(p.expectedPaymentDate)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-emerald-400">{formatCurrency(p.amount)}</p>
                  <StatusBadge status={p.status} type="payment" />
                </div>
              </div>

              {/* Progress Timeline Stepper */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-[10px]">
                {['Event Done', 'Pending Verification', 'Processing Payout', 'Paid to Account'].map((st, idx) => {
                  const active = getStepCompleted(p.status, idx + 1);
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        active
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      {st}
                    </div>
                  );
                })}
              </div>

              {/* Reference ID & Success Message */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
                  <span>UTR / Transaction Reference: {p.transactionRef || 'Pending'}</span>
                  {p.paidAt && <span className="text-emerald-400 font-bold">Paid On: {formatDate(p.paidAt)}</span>}
                </div>
                {p.status === 'PAID' && (
                  <div className="p-2 mt-1 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Payment has been processed successfully by JobbyHop.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerPayments;
