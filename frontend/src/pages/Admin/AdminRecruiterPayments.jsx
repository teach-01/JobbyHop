import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  IndianRupee,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  RefreshCw,
  Building2,
  User,
  Calendar,
  Hash,
  X,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import recruiterPaymentService from '../../services/recruiterPaymentService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatCard from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const AdminRecruiterPayments = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [copiedUtr, setCopiedUtr] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recruiterPaymentService.getAllRecruiterPayments({
        status: statusFilter,
        search: searchTerm,
      });

      if (res.success) {
        setPayments(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      } else {
        setError(res.message || 'Failed to load recruiter payments');
      }
    } catch (err) {
      setError('An error occurred while loading recruiter payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleCopyUtr = (utr) => {
    if (utr) {
      navigator.clipboard.writeText(utr);
      setCopiedUtr(true);
      setTimeout(() => setCopiedUtr(false), 2000);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase bg-purple-500/10 text-purple-300 px-3 py-1 rounded-full border border-purple-500/20">
              Admin Financial Control
            </span>
            <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/20">
              Recruiter → Admin
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-2">Recruiter Payments Queue</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track payments received from Recruiters for approved event postings and verify transaction UTR references.
          </p>
        </div>

        <button
          onClick={fetchPayments}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Records
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recruiter Inflow</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white mt-3">
            {formatCurrency(summary?.totalAmount || 0)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.totalCount || 0} total approved event payment{(summary?.totalCount || 0) === 1 ? '' : 's'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Payments Received</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-400 mt-3">
            {formatCurrency(summary?.completedAmount || 0)}
          </h3>
          <p className="text-[11px] text-emerald-400/70 mt-1">
            {summary?.completedCount || 0} completed with UTR proof
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending From Recruiters</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 mt-3">
            {formatCurrency(summary?.pendingAmount || 0)}
          </h3>
          <p className="text-[11px] text-amber-400/70 mt-1">
            {summary?.pendingCount || 0} event payment{(summary?.pendingCount || 0) === 1 ? '' : 's'} awaiting payment
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Records' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'PENDING', label: 'Pending' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search recruiter, event, UTR..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Payments List / Table */}
      {loading ? (
        <LoadingSpinner label="Loading recruiter payments..." />
      ) : error ? (
        <div className="glass-card p-8 rounded-3xl border border-rose-500/30 text-center space-y-3 bg-rose-950/20">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-white font-bold">{error}</p>
          <button
            onClick={fetchPayments}
            className="px-4 py-2 rounded-xl bg-rose-600/30 text-rose-300 text-xs font-bold hover:bg-rose-600/50"
          >
            Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No recruiter payment records found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'Payments will appear once recruiters create events and Admin approves them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden lg:block glass-card rounded-3xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-extrabold">
                <tr>
                  <th className="py-4 px-6">Recruiter</th>
                  <th className="py-4 px-6">Event / Job</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">UTR / Reference</th>
                  <th className="py-4 px-6">Method</th>
                  <th className="py-4 px-6">Payment Date</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {payments.map((p) => {
                  const isCompleted = p.status === 'COMPLETED';
                  const job = p.jobId || {};
                  const payDate = p.paymentDate || p.updatedAt;

                  return (
                    <tr key={p._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white">{p.recruiterName}</div>
                        <div className="text-[11px] text-slate-400">{p.recruiterEmail}</div>
                        {p.companyName && (
                          <div className="text-[10px] text-purple-400/80 mt-0.5">{p.companyName}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-white max-w-[200px] truncate">
                          {job.title || 'Event'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {job.eventType || 'Event'} • {job.eventDate ? formatDate(job.eventDate) : 'Date TBD'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-black text-sm ${isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {formatCurrency(p.amount)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> COMPLETED
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> PENDING
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono">
                        {isCompleted && p.utr ? (
                          <span className="text-emerald-300 font-semibold">{p.utr}</span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {isCompleted && p.paymentMethod ? (
                          <span className="font-bold text-white uppercase text-[11px]">{p.paymentMethod}</span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {isCompleted && payDate ? (
                          formatDate(payDate)
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {payments.map((p) => {
              const isCompleted = p.status === 'COMPLETED';
              const job = p.jobId || {};
              const payDate = p.paymentDate || p.updatedAt;

              return (
                <div
                  key={p._id}
                  className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-purple-400">
                        Recruiter Payment
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{p.recruiterName}</h4>
                      <p className="text-[11px] text-slate-400">{p.recruiterEmail}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isCompleted ? 'COMPLETED' : 'PENDING'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Event:</span>
                      <span className="font-bold text-white max-w-[60%] truncate text-right">
                        {job.title || 'Event'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className={`font-black text-sm ${isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                    {isCompleted && p.utr && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">UTR:</span>
                        <span className="font-mono font-bold text-emerald-300">{p.utr}</span>
                      </div>
                    )}
                    {isCompleted && p.paymentMethod && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Method:</span>
                        <span className="font-semibold text-white uppercase">{p.paymentMethod}</span>
                      </div>
                    )}
                    {isCompleted && payDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Paid On:</span>
                        <span className="text-slate-300">{formatDate(payDate)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedPayment(p)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5 text-purple-400" /> View Complete Details
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full">
                    Recruiter Payment Record
                  </span>
                  <h3 className="text-lg font-extrabold text-white mt-1">Payment Details</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Status & Amount Highlight */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Recruiter Payable Amount</span>
                  <h2 className="text-3xl font-black text-white mt-0.5">
                    {formatCurrency(selectedPayment.amount)}
                  </h2>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                    selectedPayment.status === 'COMPLETED'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {selectedPayment.status === 'COMPLETED' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> COMPLETED ✓
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" /> PAYMENT PENDING
                    </>
                  )}
                </span>
              </div>

              {/* Recruiter Information */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Recruiter Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Full Name</span>
                    <span className="font-bold text-white">{selectedPayment.recruiterName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Email</span>
                    <span className="font-semibold text-slate-300">{selectedPayment.recruiterEmail || 'N/A'}</span>
                  </div>
                  {selectedPayment.companyName && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Company</span>
                      <span className="font-semibold text-slate-300">{selectedPayment.companyName}</span>
                    </div>
                  )}
                  {selectedPayment.recruiterPhone && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone</span>
                      <span className="font-semibold text-slate-300">{selectedPayment.recruiterPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Event Information */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Job / Event Details
                </h4>
                <div className="space-y-2 text-xs pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Event Title:</span>
                    <span className="font-bold text-white">{selectedPayment.jobId?.title || 'N/A'}</span>
                  </div>
                  {selectedPayment.jobId?.eventType && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Event Type:</span>
                      <span className="font-semibold text-slate-300">{selectedPayment.jobId.eventType}</span>
                    </div>
                  )}
                  {selectedPayment.jobId?.eventDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Event Date:</span>
                      <span className="font-semibold text-slate-300">
                        {formatDate(selectedPayment.jobId.eventDate)}
                      </span>
                    </div>
                  )}
                  {selectedPayment.jobId?.workersRequired && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Workers Required:</span>
                      <span className="font-semibold text-slate-300">
                        {selectedPayment.jobId.workersRequired} workers
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Proof Details */}
              {selectedPayment.status === 'COMPLETED' && (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                  <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Payment Submission Proof
                  </h4>
                  <div className="space-y-2 text-xs pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">UTR / Transaction No:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-300 select-all">
                          {selectedPayment.utr || 'N/A'}
                        </span>
                        {selectedPayment.utr && (
                          <button
                            onClick={() => handleCopyUtr(selectedPayment.utr)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                          >
                            {copiedUtr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payment Method:</span>
                      <span className="font-bold text-white uppercase">{selectedPayment.paymentMethod || 'UPI'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payment Date:</span>
                      <span className="text-slate-200">
                        {selectedPayment.paymentDate
                          ? formatDate(selectedPayment.paymentDate)
                          : formatDate(selectedPayment.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setSelectedPayment(null)}
                className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecruiterPayments;
