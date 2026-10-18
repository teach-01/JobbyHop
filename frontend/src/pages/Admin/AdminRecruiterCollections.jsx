import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  WalletCards,
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
  XCircle,
  FileText,
  MapPin,
  Users,
  Printer,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import recruiterPaymentService from '../../services/recruiterPaymentService';
import bulkAdminService from '../../services/bulkAdminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getLocationString } from '../../utils/locationHelper';
import { useNotifications } from '../../context/NotificationContext';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar } from '../../components/admin/BulkActionComponents';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
const ConfirmDialog = ({ open, title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${confirmClass || 'bg-rose-600 hover:bg-rose-500 text-white'}`}
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminRecruiterCollections = () => {
  const { showToast } = useNotifications();

  // ── View mode: 'active' | 'trash'
  const [viewMode, setViewMode] = useState('active');

  // ── Active collections state
  const [collections, setCollections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  // ── Trash state
  const [trashItems, setTrashItems] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState('');
  const [trashSearch, setTrashSearch] = useState('');

  // ── Modal / detail
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);

  // ── Confirmation dialog
  const [confirm, setConfirm] = useState({
    open: false, title: '', message: '', confirmLabel: '', confirmClass: '', onConfirm: null, loading: false,
  });
  const closeConfirm = () => setConfirm((c) => ({ ...c, open: false, loading: false }));

  // ── Filtered collections by date
  const filteredCollections = useMemo(() => {
    let result = collections;
    if (dateFilter.preset !== 'all') {
      result = result.filter((c) => {
        const d = c.paymentDate || c.paidAt || c.verifiedAt || c.submittedAt || c.createdAt;
        return matchesDateFilter(d, dateFilter);
      });
    }
    return result;
  }, [collections, dateFilter]);

  const filteredTrash = useMemo(() => {
    let result = trashItems;
    if (dateFilter.preset !== 'all') {
      result = result.filter((item) => {
        const d = item.paymentDate || item.paidAt || item.verifiedAt || item.submittedAt || item.createdAt;
        return matchesDateFilter(d, dateFilter);
      });
    }
    return result;
  }, [trashItems, dateFilter]);

  const displaySummary = useMemo(() => {
    if (dateFilter.preset === 'all' && summary) return summary;
    const totalAmount = filteredCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingAmount = filteredCollections.filter((c) => c.status === 'PENDING').reduce((sum, c) => sum + (c.amount || 0), 0);
    const processingAmount = filteredCollections.filter((c) => c.status === 'PROCESSING' || c.status === 'COMPLETED').reduce((sum, c) => sum + (c.amount || 0), 0);
    const paidAmount = filteredCollections.filter((c) => c.status === 'PAID').reduce((sum, c) => sum + (c.amount || 0), 0);
    return {
      totalAmount,
      totalCount: filteredCollections.length,
      pendingAmount,
      pendingCount: filteredCollections.filter((c) => c.status === 'PENDING').length,
      processingAmount,
      processingCount: filteredCollections.filter((c) => c.status === 'PROCESSING' || c.status === 'COMPLETED').length,
      paidAmount,
      paidCount: filteredCollections.filter((c) => c.status === 'PAID').length,
    };
  }, [summary, filteredCollections, dateFilter]);

  // ── Bulk selection
  const activeBulk = useBulkSelection(filteredCollections);
  const trashBulk  = useBulkSelection(filteredTrash);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await recruiterPaymentService.getTrashCollections({ limit: 1 });
      if (res.success) {
        setTrashCount(res.trashCount || (res.collections || []).length);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recruiterPaymentService.getAllCollections({
        status: statusFilter,
        search: searchTerm,
      });
      if (res.success) {
        setCollections(Array.isArray(res.data) ? res.data : (res.payments || []));
        if (res.summary) setSummary(res.summary);
      } else {
        setError(res.message || 'Failed to load recruiter collections');
      }
    } catch {
      setError('An error occurred while loading recruiter collections.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  const fetchTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError('');
    try {
      const res = await recruiterPaymentService.getTrashCollections({ search: trashSearch });
      if (res.success) {
        const items = res.collections || res.data || [];
        setTrashItems(items);
        setTrashCount(res.trashCount || items.length);
      } else {
        setTrashError(res.message || 'Failed to load trash');
      }
    } catch {
      setTrashError('An error occurred while loading trash.');
    } finally {
      setTrashLoading(false);
    }
  }, [trashSearch]);

  useEffect(() => {
    fetchTrashCount();
  }, [fetchTrashCount]);

  useEffect(() => {
    if (viewMode === 'active') fetchCollections();
    else fetchTrash();
  }, [viewMode, statusFilter]);

  const handleSearch = (e) => { e.preventDefault(); fetchCollections(); };
  const handleTrashSearch = (e) => { e.preventDefault(); fetchTrash(); };

  const handleCopyUtr = (utr) => {
    if (utr) {
      navigator.clipboard.writeText(utr);
      setCopiedUtr(true);
      setTimeout(() => setCopiedUtr(false), 2000);
    }
  };

  const handleUpdateStatus = async (collectionId, targetStatus) => {
    setActionLoading(true);
    try {
      const res = await recruiterPaymentService.updateCollectionStatus(collectionId, {
        status: targetStatus,
        adminNotes: adminNotes.trim(),
      });

      if (res.success) {
        showToast(
          `Collection status updated to ${targetStatus} successfully!`,
          'success'
        );
        // Refresh updated collection in modal
        setSelectedCollection((prev) =>
          prev ? { ...prev, ...res.data, status: targetStatus, adminNotes: adminNotes.trim() } : null
        );
        // Refresh list
        fetchCollections();
      } else {
        showToast(res.message || 'Failed to update collection status', 'error');
      }
    } catch (err) {
      showToast('An error occurred while updating status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetailsModal = (collection) => {
    setSelectedCollection(collection);
    setAdminNotes(collection.adminNotes || '');
  };

  // ── Soft Delete ──────────────────────────────────────────────────────────────
  const handleSoftDelete = (collection) => {
    setConfirm({
      open: true,
      title: 'Move to Trash?',
      message: `This will move the collection record for "${collection.recruiterName || 'this recruiter'}" to trash. It can be restored within 30 days.`,
      confirmLabel: 'Move to Trash',
      confirmClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await recruiterPaymentService.softDeleteCollection(collection._id);
        closeConfirm();
        if (res.success) {
          showToast('Collection moved to trash.', 'success');
          fetchCollections();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Failed to delete collection.', 'error');
        }
      },
    });
  };

  // ── Bulk Soft Delete ─────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    const ids = activeBulk.selectedIdsArray;
    if (!ids || !ids.length) return;
    setConfirm({
      open: true,
      title: `Move ${ids.length} Record${ids.length > 1 ? 's' : ''} to Trash?`,
      message: `The selected ${ids.length} collection record${ids.length > 1 ? 's' : ''} will be moved to trash. They can be restored within 30 days.`,
      confirmLabel: 'Move to Trash',
      confirmClass: 'bg-rose-600 hover:bg-rose-500 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await bulkAdminService.bulkDeleteCollections(ids);
        closeConfirm();
        if (res.success) {
          showToast(`${ids.length} collection${ids.length > 1 ? 's' : ''} moved to trash.`, 'success');
          activeBulk.clearSelection();
          fetchCollections();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Bulk delete failed.', 'error');
        }
      },
    });
  };

  // ── Restore ──────────────────────────────────────────────────────────────────
  const handleRestore = (item) => {
    setConfirm({
      open: true,
      title: 'Restore Collection?',
      message: `This will restore the collection record for "${item.recruiterName || 'this recruiter'}" back to active collections.`,
      confirmLabel: 'Restore',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await recruiterPaymentService.restoreCollection(item._id);
        closeConfirm();
        if (res.success) {
          showToast('Collection restored successfully.', 'success');
          fetchTrash();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Restore failed.', 'error');
        }
      },
    });
  };

  // ── Bulk Restore ─────────────────────────────────────────────────────────────
  const handleBulkRestore = () => {
    const ids = trashBulk.selectedIdsArray;
    if (!ids || !ids.length) return;
    setConfirm({
      open: true,
      title: `Restore ${ids.length} Record${ids.length > 1 ? 's' : ''}?`,
      message: `The selected ${ids.length} collection record${ids.length > 1 ? 's' : ''} will be restored back to active collections.`,
      confirmLabel: 'Restore All',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await bulkAdminService.bulkRestoreCollections(ids);
        closeConfirm();
        if (res.success) {
          showToast(`${ids.length} collection${ids.length > 1 ? 's' : ''} restored.`, 'success');
          trashBulk.clearSelection();
          fetchTrash();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Bulk restore failed.', 'error');
        }
      },
    });
  };

  // ── Permanent Delete ─────────────────────────────────────────────────────────
  const handlePermanentDelete = (item) => {
    setConfirm({
      open: true,
      title: '⚠️ Permanently Delete?',
      message: `This will permanently delete the collection record for "${item.recruiterName || 'this recruiter'}". This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      confirmClass: 'bg-rose-700 hover:bg-rose-600 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await recruiterPaymentService.permanentDeleteCollection(item._id);
        closeConfirm();
        if (res.success) {
          showToast('Collection permanently deleted.', 'success');
          fetchTrash();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Permanent delete failed.', 'error');
        }
      },
    });
  };

  // ── Bulk Permanent Delete ────────────────────────────────────────────────────
  const handleBulkPermanentDelete = () => {
    const ids = trashBulk.selectedIdsArray;
    if (!ids || !ids.length) return;
    setConfirm({
      open: true,
      title: `⚠️ Permanently Delete ${ids.length} Record${ids.length > 1 ? 's' : ''}?`,
      message: `The selected ${ids.length} collection record${ids.length > 1 ? 's' : ''} will be permanently deleted. This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      confirmClass: 'bg-rose-700 hover:bg-rose-600 text-white',
      loading: false,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, loading: true }));
        const res = await bulkAdminService.bulkPermanentDeleteCollections(ids);
        closeConfirm();
        if (res.success) {
          showToast(`${ids.length} collection${ids.length > 1 ? 's' : ''} permanently deleted.`, 'success');
          trashBulk.clearSelection();
          fetchTrash();
          fetchTrashCount();
        } else {
          showToast(res.message || 'Bulk permanent delete failed.', 'error');
        }
      },
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> PAID
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> SUBMITTED
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> IN REVIEW
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" /> REJECTED
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> PENDING
          </span>
        );
    }
  };

  // (bulk selection moved to top of component)

  const handleExportPdf = () => {
    const selected = filteredCollections.filter((c) => activeBulk.isSelected(c._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportDetailedRecordsToPdf({
      title: 'Recruiter Collections',
      subtitle: `Recruiter → JobbyHop Admin Payments — ${statusFilter}${searchTerm ? ` | "${searchTerm}"` : ''} — ${dateStr}`,
      filename: `JobbyHop_Recruiter_Collections_${dateStr}.pdf`,
      records: selected,
      buildCard: (c) => [
        {
          heading: 'Recruiter Information',
          color: '#8b5cf6',
          rows: [
            ['Recruiter Name',    c.recruiterName || c.recruiterProfile?.fullName || c.recruiterProfile?.companyName],
            ['Recruiter Email',   c.recruiterEmail || c.recruiterProfile?.email],
            ['Recruiter Phone',   c.recruiterProfile?.phone || c.recruiterId?.phone],
            ['Company',           c.recruiterProfile?.companyName || c.companyName],
            ['Recruiter ID',      c.recruiterId?._id || c.recruiterId],
          ],
        },
        {
          heading: 'Event / Job Information',
          color: '#06b6d4',
          rows: [
            ['Event Title',      c.jobId?.title],
            ['Event Type',       c.jobId?.eventType],
            ['Event Date',       formatDate(c.jobId?.eventDate)],
            ['Location',         getLocationString(c.jobId?.location)],
            ['Venue / Address',  typeof c.jobId?.location === 'object' ? (c.jobId?.location?.venue || c.jobId?.location?.address) : null],
            ['Job ID',           c.jobId?._id || c.jobId],
          ],
        },
        {
          heading: 'Collection / Payment Details',
          color: '#10b981',
          rows: [
            ['Amount Due',         formatCurrency(c.amount)],
            ['Rate per Person',    c.perPersonRate ? `${formatCurrency(c.perPersonRate)} / person` : (c.jobId?.recruiterRequestedRate ? `${formatCurrency(c.jobId?.recruiterRequestedRate)} / person` : (c.jobId?.offeredAmountPerPerson ? `${formatCurrency(c.jobId?.offeredAmountPerPerson)} / person` : null))],
            ['Verified Attendees', c.verifiedAttendeesCount !== undefined ? `${c.verifiedAttendeesCount} worker(s)` : null],
            ['Collection Status',  c.status],
            ['UTR / Reference',    c.utr || c.utrNumber],
            ['Payment Date',       (c.utr || c.utrNumber) && c.paymentDate ? formatDate(c.paymentDate) : null],
            ['Admin Notes',        c.adminNotes || c.notes],
            ['Collection Created', formatDate(c.createdAt)],
            ['Record ID',          c._id],
          ],
        },
        {
          heading: 'Staff Details',
          color: '#f59e0b',
          rows: [
            ['Workers Required',      c.jobId?.workersRequired],
            ['Workers Assigned',      c.jobId?.assignedWorkersCount],
            ['Recruiter Agreed Rate', formatCurrency(c.perPersonRate || c.jobId?.recruiterRequestedRate || c.jobId?.offeredAmountPerPerson || c.jobId?.recruiterProposedPayment)],
            ['Admin Worker Payout',   formatCurrency(c.jobId?.adminApprovedPayment)],
          ],
        },
      ],
    });
  };


  return (
    <div className="space-y-8 pb-12">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        confirmClass={confirm.confirmClass}
        loading={confirm.loading}
        onConfirm={confirm.onConfirm}
        onCancel={closeConfirm}
      />
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase bg-purple-500/10 text-purple-300 px-3 py-1 rounded-full border border-purple-500/20">
              Admin Financial Control
            </span>
            <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/20">
              Recruiter → JobbyHop Admin
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-2">Recruiter Collections</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and manage payments collected from Recruiters for approved event postings. Verify UTR references and mark as PAID.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Trash Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'trash' ? 'active' : 'trash')}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-colors flex items-center gap-2 ${
              viewMode === 'trash'
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {viewMode === 'trash' ? 'Back to Active' : 'Trash'}
            {viewMode !== 'trash' && (trashCount > 0 || trashItems.length > 0) && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                {trashCount || trashItems.length}
              </span>
            )}
          </button>
          <button
            onClick={viewMode === 'active' ? fetchCollections : fetchTrash}
            disabled={loading || trashLoading}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || trashLoading) ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── TRASH VIEW ──────────────────────────────────────────────────────────── */}
      {viewMode === 'trash' && (
        <>
          <div className="glass-card p-4 rounded-2xl border border-rose-500/30 bg-rose-950/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-rose-300">Trash — Deleted Collection Records</p>
                <p className="text-[11px] text-rose-400/60 mt-0.5">Records are permanently deleted after 30 days. Restore them to recover.</p>
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
              <form onSubmit={handleTrashSearch} className="flex items-center gap-2 w-full sm:w-72">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search trash..."
                    value={trashSearch}
                    onChange={(e) => setTrashSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <button type="submit" className="px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0">
                  Search
                </button>
              </form>
            </div>
          </div>

          <BulkActionToolbar
            selectedCount={trashBulk.selectedCount}
            onClear={trashBulk.clearSelection}
            visible={trashBulk.selectedCount > 0}
            actions={[
              { label: 'Restore Selected', icon: RotateCcw, onClick: handleBulkRestore },
              { label: 'Delete Permanently', icon: Trash2, onClick: handleBulkPermanentDelete, variant: 'danger' },
            ]}
          />

          {trashLoading ? (
            <LoadingSpinner label="Loading trash..." />
          ) : trashError ? (
            <div className="glass-card p-10 rounded-3xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-white font-bold">{trashError}</p>
              <button onClick={fetchTrash} className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-600/40 text-rose-400 font-bold text-xs hover:bg-rose-600/40">Retry</button>
            </div>
          ) : filteredTrash.length === 0 ? (
            <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-3">
              <Trash2 className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-lg font-bold text-white">Trash is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {trashSearch || dateFilter.preset !== 'all' ? 'No deleted records matched your filter criteria.' : 'Deleted collection records will appear here.'}
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-4 w-10">
                        <BulkCheckbox
                          id="trash-select-all"
                          checked={trashBulk.isAllSelected}
                          indeterminate={trashBulk.isIndeterminate}
                          onChange={() => trashBulk.isAllSelected ? trashBulk.clearSelection() : trashBulk.selectAll()}
                        />
                      </th>
                      <th className="p-4">Recruiter</th>
                      <th className="p-4">Job/Event</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Deleted On</th>
                      <th className="p-4">Auto-Delete</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTrash.map((item) => (
                      <tr key={item._id} className={`hover:bg-slate-800/30 transition-colors ${trashBulk.isSelected(item._id) ? 'bg-rose-500/5' : ''}`}>
                        <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <BulkCheckbox id={`trash-cb-${item._id}`} checked={trashBulk.isSelected(item._id)} onChange={() => trashBulk.toggleSelection(item._id)} />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {item.recruiterName?.charAt(0).toUpperCase() || 'R'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-300 truncate max-w-[150px]">{item.recruiterName}</p>
                              <p className="text-[11px] text-slate-500 truncate max-w-[150px]">{item.recruiterEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-400 truncate max-w-[180px]">{item.jobId?.title || 'Event Record'}</p>
                          <p className="text-[11px] text-slate-600">{getLocationString(item.jobId?.location) || '—'}</p>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-extrabold text-slate-300 text-sm">{formatCurrency(item.amount)}</span>
                        </td>
                        <td className="p-4 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                        <td className="p-4 whitespace-nowrap text-slate-500 text-[11px]">{item.deletedAt ? formatDate(item.deletedAt) : '—'}</td>
                        <td className="p-4 whitespace-nowrap">
                          {item.permanentDeleteAt ? (
                            <span className="text-rose-400 text-[11px] font-bold">{formatDate(item.permanentDeleteAt)}</span>
                          ) : '—'}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestore(item)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all font-bold text-xs inline-flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(item)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-700 text-rose-400 hover:text-white border border-rose-500/30 transition-all font-bold text-xs inline-flex items-center gap-1.5"
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
          )}
        </>
      )}

      {/* ── ACTIVE VIEW WRAPPER (only show when not in trash) ───────────────────── */}
      {viewMode === 'active' && <>

      {/* Summary Cards: Total Collections, Pending, Processing/In Review, Paid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Collections */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collections</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <WalletCards className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white mt-3">
            {formatCurrency(displaySummary?.totalAmount || displaySummary?.totalCollections || 0)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {displaySummary?.totalCount || 0} total event collection{(displaySummary?.totalCount || 0) === 1 ? '' : 's'}
          </p>
        </div>

        {/* 2. Pending (Awaiting recruiter payment) */}
        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 mt-3">
            {formatCurrency(displaySummary?.pendingAmount || 0)}
          </h3>
          <p className="text-[11px] text-amber-400/70 mt-1">
            {displaySummary?.pendingCount || 0} awaiting payment submission
          </p>
        </div>

        {/* 3. In Review / Processing (Recruiter submitted, Admin to verify) */}
        <div className="glass-card p-5 rounded-2xl border border-purple-500/20 bg-purple-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">In Review</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-300 mt-3">
            {formatCurrency((displaySummary?.processingAmount || 0) + (displaySummary?.completedAmount || 0))}
          </h3>
          <p className="text-[11px] text-purple-300/70 mt-1">
            {(displaySummary?.processingCount || 0) + (displaySummary?.completedCount || 0)} submitted, awaiting Admin verification
          </p>
        </div>

        {/* 4. Paid (Admin verified) */}
        <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Paid & Verified</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-400 mt-3">
            {formatCurrency(displaySummary?.paidAmount || 0)}
          </h3>
          <p className="text-[11px] text-emerald-400/70 mt-1">
            {displaySummary?.paidCount || 0} verified & confirmed paid
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/60">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'PROCESSING', label: 'In Review' },
            { id: 'COMPLETED', label: 'Submitted' },
            { id: 'PAID', label: 'Paid' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter & Search Bar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search recruiter, event, or UTR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Main Table / Content */}
      {loading ? (
        <LoadingSpinner label="Loading recruiter collections..." />
      ) : error ? (
        <div className="glass-card p-10 rounded-3xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-white font-bold">{error}</p>
          <button
            onClick={fetchCollections}
            className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-600/40 text-rose-400 font-bold text-xs hover:bg-rose-600/40"
          >
            Retry
          </button>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <WalletCards className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Recruiter Collections Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL' || dateFilter.preset !== 'all'
              ? 'No collection records matched your filter criteria.'
              : 'Approved events requiring recruiter collections will automatically appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Bulk toolbar */}
          <BulkActionToolbar
            selectedCount={activeBulk.selectedCount}
            onClear={activeBulk.clearSelection}
            visible={activeBulk.selectedCount > 0}
            actions={[
              { label: 'Print / Save PDF', icon: Printer, onClick: handleExportPdf },
              { label: 'Move to Trash', icon: Trash2, onClick: handleBulkDelete, variant: 'danger' },
            ]}
          />

          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-4 w-10">
                      <BulkCheckbox
                        id="coll-select-all"
                        checked={activeBulk.isAllSelected}
                        indeterminate={activeBulk.isIndeterminate}
                        onChange={() => activeBulk.isAllSelected ? activeBulk.clearSelection() : activeBulk.selectAll()}
                      />
                    </th>
                    <th className="p-4">Recruiter</th>
                    <th className="p-4">Job/Event</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">UTR / Transaction Reference</th>
                    <th className="p-4">Payment Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCollections.map((c) => {
                    const utr = c.utr || c.utrNumber;
                    const paymentDate = c.paymentDate;

                    return (
                      <tr
                        key={c._id}
                        className={`hover:bg-slate-800/30 transition-colors group cursor-pointer ${activeBulk.isSelected(c._id) ? 'bg-brand-500/5' : ''}`}
                        onClick={() => openDetailsModal(c)}
                      >
                        {/* Checkbox */}
                        <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <BulkCheckbox
                            id={`coll-cb-${c._id}`}
                            checked={activeBulk.isSelected(c._id)}
                            onChange={() => activeBulk.toggleSelection(c._id)}
                          />
                        </td>
                      {/* Recruiter */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.recruiterName?.charAt(0).toUpperCase() || 'R'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-[150px]">
                              {c.recruiterName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {c.recruiterEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Job/Event */}
                      <td className="p-4">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-200 truncate max-w-[180px]">
                            {c.jobId?.title || 'Event Record'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {getLocationString(c.jobId?.location) || '—'}
                          </p>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-extrabold text-white text-sm">
                          {formatCurrency(c.amount)}
                        </span>
                        {c.verifiedAttendeesCount !== undefined && (
                          <span className="block text-[10px] text-emerald-400 font-semibold">
                            {c.verifiedAttendeesCount} attendee{c.verifiedAttendeesCount === 1 ? '' : 's'}
                            {c.perPersonRate > 0 && ` × ${formatCurrency(c.perPersonRate)}`}
                          </span>
                        )}
                      </td>

                      {/* UTR / Transaction Reference */}
                      <td className="p-4">
                        {utr ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] hover:border-purple-500/50 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyUtr(utr);
                            }}
                            title="Click to copy UTR"
                          >
                            <Hash className="w-3 h-3 text-purple-400" />
                            <span>{utr}</span>
                            <Copy className="w-3 h-3 text-slate-500 hover:text-white" />
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">— Not Submitted —</span>
                        )}
                      </td>

                      {/* Payment Date */}
                      <td className="p-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {utr && paymentDate ? formatDate(paymentDate) : '—'}
                      </td>

                      {/* Status */}
                      <td className="p-4 whitespace-nowrap">
                        {getStatusBadge(c.status)}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openDetailsModal(c)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all font-bold text-xs inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button
                            onClick={() => handleSoftDelete(c)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-all font-bold text-xs inline-flex items-center gap-1.5"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        </>
      )}
      </> /* end active view */}

      {/* Complete Payment Details Modal */}
      {selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <WalletCards className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full">
                    Recruiter Collection Record
                  </span>
                  <h3 className="text-lg font-extrabold text-white mt-1">Collection Details & Verification</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCollection(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Highlight Banner: Amount + Status */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Recruiter Payable Amount
                  </span>
                  <h2 className="text-3xl font-black text-white mt-1">
                    {formatCurrency(selectedCollection.amount)}
                  </h2>
                </div>
                <div>{getStatusBadge(selectedCollection.status)}</div>
              </div>

              {/* Grid: Recruiter Info & Event Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recruiter Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-400" /> Recruiter Information
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {selectedCollection.recruiterName || 'Recruiter'}
                    </p>
                    {selectedCollection.companyName && (
                      <p className="text-xs text-slate-300 font-medium">
                        {selectedCollection.companyName}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedCollection.recruiterEmail}
                    </p>
                    {selectedCollection.recruiterPhone && (
                      <p className="text-xs text-slate-500">
                        {selectedCollection.recruiterPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" /> Job / Event Reference
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {selectedCollection.jobId?.title || 'Event Record'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {getLocationString(selectedCollection.jobId?.location) || 'Location Not Specified'}
                    </p>
                    {selectedCollection.jobId?.eventDate && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(selectedCollection.jobId.eventDate)}
                      </p>
                    )}
                    {selectedCollection.verifiedAttendeesCount !== undefined && (
                      <p className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3" /> Verified Attendees: {selectedCollection.verifiedAttendeesCount} worker(s)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Transaction & Submission Details */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-purple-400" /> Transaction & UTR Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">UTR / Transaction Number:</span>
                    {selectedCollection.utr || selectedCollection.utrNumber ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-white font-bold bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                          {selectedCollection.utr || selectedCollection.utrNumber}
                        </span>
                        <button
                          onClick={() => handleCopyUtr(selectedCollection.utr || selectedCollection.utrNumber)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Copy UTR"
                        >
                          {copiedUtr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-amber-400 italic">Pending Recruiter Submission</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Payment Method:</span>
                    <span className="text-slate-200 font-medium mt-1 inline-block">
                      {selectedCollection.paymentMethod || 'UPI / Bank Transfer'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Submission Date:</span>
                    <span className="text-slate-300 font-medium mt-1 inline-block">
                      {selectedCollection.paymentDate
                        ? formatDate(selectedCollection.paymentDate)
                        : formatDate(selectedCollection.updatedAt)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Payment Proof / Screenshot:</span>
                    {selectedCollection.paymentProof ? (
                      <a
                        href={selectedCollection.paymentProof}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:underline font-bold mt-1 inline-block"
                      >
                        View Attached Proof →
                      </a>
                    ) : (
                      <span className="text-slate-500 italic mt-1 inline-block">Not provided</span>
                    )}
                  </div>
                </div>

                {selectedCollection.notes && (
                  <div className="border-t border-slate-900 pt-2">
                    <span className="text-slate-500 block text-[11px]">Recruiter Notes:</span>
                    <p className="text-slate-300 text-xs mt-0.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {selectedCollection.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Action Review Panel */}
              <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" /> Admin Moderation & Action
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Workflow: Recruiter submits UTR → Admin marks PAID or REJECTED
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                    Admin Verification Notes (Optional reason or audit log remark):
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="e.g., UTR verified in bank account, amount confirmed ₹X"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Status Trigger Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedCollection._id, 'PAID')}
                    disabled={actionLoading || selectedCollection.status === 'PAID'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                      selectedCollection.status === 'PAID'
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 active:scale-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {selectedCollection.status === 'PAID' ? 'Already Marked PAID' : 'Mark as PAID ✓'}
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedCollection._id, 'REJECTED')}
                    disabled={actionLoading || selectedCollection.status === 'REJECTED'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      selectedCollection.status === 'REJECTED'
                        ? 'bg-rose-950/40 text-rose-400 border-rose-500/30 cursor-not-allowed'
                        : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/40 active:scale-95'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Reject Payment
                  </button>

                  {selectedCollection.status !== 'PROCESSING' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCollection._id, 'PROCESSING')}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Set to In Review
                    </button>
                  )}

                  {selectedCollection.status !== 'PENDING' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCollection._id, 'PENDING')}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" /> Reset to Pending
                    </button>
                  )}
                </div>

                {selectedCollection.reviewedAt && (
                  <p className="text-[10px] text-slate-500 pt-1">
                    Last reviewed by Admin on {formatDate(selectedCollection.reviewedAt)}
                    {selectedCollection.adminNotes && ` — Notes: "${selectedCollection.adminNotes}"`}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
              <button
                onClick={() => {
                  const c = selectedCollection;
                  setSelectedCollection(null);
                  handleSoftDelete(c);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-bold text-xs transition-colors flex items-center gap-1.5 border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Move to Trash
              </button>
              <button
                onClick={() => setSelectedCollection(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecruiterCollections;
