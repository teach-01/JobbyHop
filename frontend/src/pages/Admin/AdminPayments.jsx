import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import paymentService from '../../services/paymentService';
import PaymentModal from '../../components/admin/PaymentModal';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditCard, Clock, Search, X, Trash2, RotateCcw, AlertTriangle, ShieldCheck, Printer } from 'lucide-react';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar } from '../../components/admin/BulkActionComponents';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

const STATUS_TABS = ['ALL', 'PENDING', 'PROCESSING', 'PAID', 'ON_HOLD', 'FAILED'];

// ── Confirmation Dialog ────────────────────────────────────────────────────
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmClass = 'bg-red-600 hover:bg-red-700',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm mx-4 p-6 rounded-2xl border border-slate-700 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Payment Trash View ─────────────────────────────────────────────────────
const PaymentTrashTab = ({ showToast, onCountChange, onRestored, dateFilter, setDateFilter }) => {
  const [trashPayments, setTrashPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, payment }
  const [trashSearchQuery, setTrashSearchQuery] = useState('');

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    const res = await paymentService.getTrashPayments();
    if (res.success) {
      setTrashPayments(res.data);
      onCountChange?.(res.data.length);
    }
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (payment) => {
    const res = await paymentService.restorePayment(payment._id);
    if (res.success) {
      showToast('Payment restored to active Payments.', 'success');
      const updated = trashPayments.filter((p) => p._id !== payment._id);
      setTrashPayments(updated);
      onCountChange?.(updated.length);
      onRestored?.();
    } else {
      showToast(res.message || 'Failed to restore payment.', 'error');
    }
    setConfirm(null);
  };

  const handlePermanentDelete = async (payment) => {
    const res = await paymentService.permanentDeletePayment(payment._id);
    if (res.success) {
      showToast('Payment record permanently deleted.', 'success');
      const updated = trashPayments.filter((p) => p._id !== payment._id);
      setTrashPayments(updated);
      onCountChange?.(updated.length);
    } else {
      showToast(res.message || 'Failed to permanently delete.', 'error');
    }
    setConfirm(null);
  };

  const filteredTrash = useMemo(() => {
    let result = trashPayments;
    if (dateFilter && dateFilter.preset !== 'all') {
      result = result.filter((p) => {
        const payDate = p.paidAt || p.expectedPaymentDate || p.jobId?.completedAt || p.jobId?.eventDate || p.createdAt;
        return matchesDateFilter(payDate, dateFilter);
      });
    }
    const q = trashSearchQuery.trim().toLowerCase();
    if (!q) return result;
    return result.filter((pay) => {
      const workerName = (pay.workerProfile?.fullName || '').toLowerCase();
      const workerEmail = (pay.workerId?.email || '').toLowerCase();
      const eventTitle = (pay.jobId?.title || '').toLowerCase();
      const ref = (pay.transactionRef || '').toLowerCase();
      return workerName.includes(q) || workerEmail.includes(q) || eventTitle.includes(q) || ref.includes(q);
    });
  }, [trashPayments, trashSearchQuery, dateFilter]);

  if (loading) return <LoadingSpinner label="Loading payment trash..." />;

  return (
    <div className="space-y-4">
      {/* Search Toolbar for Trash */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={trashSearchQuery}
              onChange={(e) => setTrashSearchQuery(e.target.value)}
              placeholder="Search deleted payments by worker or event name..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
            />
            {trashSearchQuery && (
              <button
                onClick={() => setTrashSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {setDateFilter && <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />}
        </div>
      </div>

      {filteredTrash.length === 0 ? (
        <EmptyState
          title={trashSearchQuery ? 'No Matching Trashed Payments' : 'Payment Trash is Empty'}
          description={
            trashSearchQuery
              ? `No deleted payments match "${trashSearchQuery}".`
              : 'Deleted payment records will appear here for 30 days before permanent removal.'
          }
        />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">UTR / Ref</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Deleted At</th>
                  <th className="px-4 py-3">Auto-Delete In</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredTrash.map((pay) => {
                  const daysLeft = pay.permanentDeleteAt
                    ? Math.max(0, Math.ceil((new Date(pay.permanentDeleteAt) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null;

                  return (
                    <tr key={pay._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-white">
                          {pay.workerProfile?.fullName || pay.workerId?.email || 'Worker'}
                        </p>
                        {pay.workerId?.email && pay.workerProfile?.fullName && (
                          <p className="text-[10px] text-slate-500">{pay.workerId.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-brand-300 font-semibold">{pay.jobId?.title || 'Unknown Event'}</td>
                      <td className="px-4 py-3.5 font-extrabold text-emerald-400">{formatCurrency(pay.amount)}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={pay.status} type="payment" />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">{pay.transactionRef || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-400">{pay.paidAt ? formatDate(pay.paidAt) : '—'}</td>
                      <td className="px-4 py-3.5 text-rose-400">{formatDate(pay.deletedAt)}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold text-[11px]">
                          <Clock className="w-3 h-3" />
                          {daysLeft !== null ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : '30 days'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setConfirm({ type: 'restore', payment: pay })}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                          <button
                            onClick={() => setConfirm({ type: 'permanent', payment: pay })}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[11px] font-bold transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Permanent Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm: Restore */}
      <ConfirmDialog
        isOpen={confirm?.type === 'restore'}
        title="Restore Payment?"
        message={`Restore payment for "${confirm?.payment?.workerProfile?.fullName || 'Worker'}" — ₹${confirm?.payment?.amount} back to active Payments?\n\nExisting payment data and status (${confirm?.payment?.status}) will remain unchanged.`}
        confirmLabel="Restore Payment"
        confirmClass="bg-emerald-600 hover:bg-emerald-700"
        onConfirm={() => handleRestore(confirm.payment)}
        onCancel={() => setConfirm(null)}
      />

      {/* Confirm: Permanent Delete */}
      <ConfirmDialog
        isOpen={confirm?.type === 'permanent'}
        title="Permanently Delete Payment Record?"
        message={`Are you sure you want to permanently delete this payment record for "${confirm?.payment?.workerProfile?.fullName || 'Worker'}" (₹${confirm?.payment?.amount} - ${confirm?.payment?.status})?\n\nThis will permanently remove the administrative payment record from the database. It cannot be undone.\n\nNote: If this payment was already completed/paid, the worker's completed payment outcome will remain preserved.`}
        confirmLabel="Permanently Delete"
        confirmClass="bg-red-600 hover:bg-red-700"
        onConfirm={() => handlePermanentDelete(confirm.payment)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

// ── Main Admin Payments Page ─────────────────────────────────────────────
export const AdminPayments = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  const [payments, setPayments] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [searchParams] = useSearchParams();
  const [deleteConfirm, setDeleteConfirm] = useState(null); // payment to soft-delete

  // Filters
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'ALL'); // 'ALL' | status | 'TRASH'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const [resActive, resTrash] = await Promise.all([
      paymentService.getAllPayments(),
      paymentService.getTrashPayments(),
    ]);

    if (resActive.success) {
      setPayments(resActive.data);
    }
    if (resTrash.success) {
      setTrashCount(resTrash.data.length);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleUpdatePayment = async (paymentId, formData) => {
    try {
      const res = await paymentService.updatePaymentStatus(paymentId, formData, adminUser);
      if (res.success) {
        showToast(`Payment status updated to ${formData.status}!`, 'success');
        fetchPayments();
      } else {
        showToast(res.message || 'Failed to update payment status', 'error');
      }
    } catch (err) {
      showToast('Failed to update payment status', 'error');
    }
  };

  const handleSoftDelete = async (payment) => {
    const res = await paymentService.softDeletePayment(payment._id);
    if (res.success) {
      showToast('Payment moved to Trash.', 'success');
      setPayments((prev) => prev.filter((p) => p._id !== payment._id));
      setTrashCount((prev) => prev + 1);
    } else {
      showToast(res.message || 'Failed to delete payment.', 'error');
    }
    setDeleteConfirm(null);
  };

  // ── Active list filtering ────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (activeTab !== 'ALL' && activeTab !== 'TRASH' && p.status !== activeTab) return false;
      const payDate = p.paidAt || p.expectedPaymentDate || p.jobId?.completedAt || p.jobId?.eventDate || p.createdAt;
      if (!matchesDateFilter(payDate, dateFilter)) return false;
      if (q) {
        const workerName = (p.workerProfile?.fullName || '').toLowerCase();
        const workerEmail = (p.workerId?.email || '').toLowerCase();
        const eventTitle = (p.jobId?.title || '').toLowerCase();
        return workerName.includes(q) || workerEmail.includes(q) || eventTitle.includes(q);
      }
      return true;
    });
  }, [payments, activeTab, q, dateFilter]);

  const countForStatus = (st) => {
    const list = dateFilter.preset !== 'all'
      ? payments.filter((p) => matchesDateFilter(p.paidAt || p.expectedPaymentDate || p.jobId?.completedAt || p.jobId?.eventDate || p.createdAt, dateFilter))
      : payments;
    return st === 'ALL' ? list.length : list.filter((p) => p.status === st).length;
  };

  const hasSearch = q.length > 0;
  const isTrashView = activeTab === 'TRASH';

  // Bulk selection (active payments only — trash has its own component)
  const bulk = useBulkSelection(filtered);

  if (loading) return <LoadingSpinner label="Loading 10-15 day payment pipeline..." />;

  const handleExportPdf = () => {
    const selected = filtered.filter((p) => bulk.isSelected(p._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportDetailedRecordsToPdf({
      title: 'Payments (10–15d)',
      subtitle: `Worker Payout Pipeline — ${activeTab}${hasSearch ? ` | Search: "${searchQuery.trim()}"` : ''} — ${dateStr}`,
      filename: `JobbyHop_Payments_${dateStr}.pdf`,
      records: selected,
      buildCard: (p) => [
        {
          heading: 'Worker Information',
          color: '#8b5cf6',
          rows: [
            ['Worker Name',     p.workerProfile?.fullName || p.workerId?.fullName || p.workerId?.name || p.workerId?.email],
            ['Worker Email',    p.workerId?.email],
            ['Worker Phone',    p.workerProfile?.phone || p.workerId?.phone],
            ['Worker ID',       p.workerId?._id || p.workerId],
          ],
        },
        {
          heading: 'Event Information',
          color: '#06b6d4',
          rows: [
            ['Event Title',       p.jobId?.title],
            ['Event Type',        p.jobId?.eventType],
            ['Event Date',        formatDate(p.jobId?.eventDate)],
            ['Location',          getLocationString(p.jobId?.location)],
            ['Venue / Address',   typeof p.jobId?.location === 'object' ? (p.jobId?.location?.venue || p.jobId?.location?.address) : null],
            ['Job ID',            p.jobId?._id || p.jobId],
          ],
        },
        {
          heading: 'Payment Details',
          color: '#10b981',
          rows: [
            ['Final Payout Amount',   formatCurrency(p.amount)],
            ['Payment Status',        p.status],
            ['Expected Payout Date',  formatDate(p.expectedPaymentDate)],
            ['Paid Date',             p.paidAt ? formatDate(p.paidAt) : null],
            ['Transaction Ref (UTR)', p.transactionRef],
            ['Payment Method',        p.paymentMethod || 'Bank Transfer / UPI'],
            ['Payout Timeline',       p.paymentTimelineText],
            ['Admin Notes',           p.adminNotes],
            ['Payment Created At',    formatDate(p.createdAt)],
            ['Payment Record ID',     p._id],
          ],
        },
        {
          heading: 'Recruiter Information',
          color: '#f59e0b',
          rows: [
            ['Recruiter Name',  p.jobId?.recruiterProfile?.fullName || p.jobId?.recruiterId?.fullName || p.jobId?.recruiterId?.email],
            ['Company',         p.jobId?.recruiterProfile?.companyName],
            ['Recruiter Email', p.jobId?.recruiterProfile?.email || p.jobId?.recruiterId?.email],
            ['Recruiter Phone', p.jobId?.recruiterProfile?.phone || p.jobId?.recruiterId?.phone],
          ],
        },
      ],
    });
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isTrashView ? (
              <>
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h1 className="text-2xl font-extrabold text-white">Payment Trash</h1>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 text-purple-400" />
                <h1 className="text-2xl font-extrabold text-white">Admin Payment Management Center</h1>
              </>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            {isTrashView
              ? 'Deleted payments are kept for 30 days before automatic permanent deletion.'
              : 'Moderate 10–15 day worker payout schedules and bank/UPI reference IDs.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isTrashView ? (
            <button
              onClick={() => {
                setActiveTab('ALL');
                fetchPayments();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors"
            >
              ← Back to Payments
            </button>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('TRASH')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[11px] font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Trash ({trashCount})
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold">
                <Clock className="w-4 h-4" /> Target Timeline: 10–15 Days
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs Toolbar: ALL | PENDING | PROCESSING | PAID | ON_HOLD | FAILED | TRASH */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
        {/* Search input (when on active payment view) */}
        {!isTrashView && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by worker or event name..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
              />
              {hasSearch && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((st) => (
            <button
              key={st}
              onClick={() => setActiveTab(st)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === st
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {st}{' '}
              <span className={`ml-0.5 ${activeTab === st ? 'text-white/70' : 'text-slate-500'}`}>
                ({countForStatus(st)})
              </span>
            </button>
          ))}

          {/* TRASH tab integrated directly into tab strip */}
          <button
            onClick={() => setActiveTab('TRASH')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'TRASH'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-900 text-rose-400 border border-rose-500/20 hover:border-rose-500/40'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" /> TRASH{' '}
            <span className={`ml-0.5 ${activeTab === 'TRASH' ? 'text-white/70' : 'text-rose-400/70'}`}>
              ({trashCount})
            </span>
          </button>
        </div>
      </div>

      {/* Render Trash View or Active Payments */}
      {isTrashView ? (
        <PaymentTrashTab
          showToast={showToast}
          onCountChange={(count) => setTrashCount(count)}
          onRestored={() => fetchPayments()}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
        />
      ) : (
        <>
          {/* Results summary when searching */}
          {hasSearch && (
            <div className="text-[11px] text-slate-400 px-1">
              {filtered.length === 0
                ? 'No results for '
                : `Showing ${filtered.length} result${filtered.length !== 1 ? 's' : ''} for `}
              <span className="text-brand-300 font-semibold">"{searchQuery.trim()}"</span>
              {activeTab !== 'ALL' && (
                <span className="text-slate-500">
                  {' '}
                  in <span className="text-slate-300">{activeTab}</span>
                </span>
              )}
            </div>
          )}

          {/* Table / Empty state */}
          {filtered.length === 0 ? (
            <EmptyState
              title={hasSearch ? 'No Payments Found' : 'No Payment Records'}
              description={
                hasSearch
                  ? `No payments match "${searchQuery.trim()}"${activeTab !== 'ALL' ? ` in ${activeTab} status` : ''}. Try a different name or clear the search.`
                  : 'No active payment records in this category.'
              }
            />
          ) : (
            <>
              {/* Bulk toolbar */}
              <BulkActionToolbar
                selectedCount={bulk.selectedCount}
                onClear={bulk.clearSelection}
                visible={bulk.selectedCount > 0}
                actions={[
                  { label: 'Print / Save PDF', icon: Printer, onClick: handleExportPdf },
                ]}
              />
              <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <BulkCheckbox
                            id="pay-select-all"
                            checked={bulk.isAllSelected}
                            indeterminate={bulk.isIndeterminate}
                            onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                          />
                        </th>
                        <th className="px-4 py-3">Worker Name</th>
                        <th className="px-4 py-3">Event Job</th>
                        <th className="px-4 py-3">Event Completed</th>
                        <th className="px-4 py-3">10–15d Payout Target</th>
                        <th className="px-4 py-3">Final Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ref ID</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filtered.map((pay) => (
                        <tr key={pay._id} className={`hover:bg-slate-800/40 transition-colors ${bulk.isSelected(pay._id) ? 'bg-brand-500/5' : ''}`}>
                          <td className="px-4 py-3.5 w-10">
                            <BulkCheckbox
                              id={`pay-cb-${pay._id}`}
                              checked={bulk.isSelected(pay._id)}
                              onChange={() => bulk.toggleSelection(pay._id)}
                            />
                          </td>
                          <td className="px-4 py-3.5 font-bold text-white">
                            {pay.workerProfile?.fullName || pay.workerId?.email || 'Worker'}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-brand-300">
                            {pay.jobId?.title || 'Unknown Event'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">{formatDate(pay.jobId?.eventDate)}</td>
                          <td className="px-4 py-3.5 text-purple-300 font-bold">{formatDate(pay.expectedPaymentDate)}</td>
                          <td className="px-4 py-3.5 font-extrabold text-emerald-400">{formatCurrency(pay.amount)}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={pay.status} type="payment" />
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {pay.transactionRef || 'Pending'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setSelectedPayment(pay)}
                                className="gradient-btn px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-[11px]"
                              >
                                <CreditCard className="w-3.5 h-3.5" /> Manage Status
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(pay)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[11px] font-bold transition-colors"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Payment Modal */}
      {selectedPayment && (
        <PaymentModal
          isOpen={Boolean(selectedPayment)}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
          onSubmitUpdate={handleUpdatePayment}
        />
      )}

      {/* Soft Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirm)}
        title="Delete this payment record?"
        message={`Delete payment record for "${deleteConfirm?.workerProfile?.fullName || deleteConfirm?.workerId?.email || 'Worker'}" — ${formatCurrency(deleteConfirm?.amount || 0)} (${deleteConfirm?.status})?\n\nThe payment will be moved to Trash and can be restored or permanently deleted.\n\nNote: If this payment has already been marked as PAID, the worker will continue to see their payout as completed.`}
        confirmLabel="Move to Trash"
        confirmClass="bg-rose-600 hover:bg-rose-700"
        onConfirm={() => handleSoftDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default AdminPayments;
