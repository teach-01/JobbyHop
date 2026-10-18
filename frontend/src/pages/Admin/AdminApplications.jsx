import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import applicationService from '../../services/applicationService';
import bulkAdminService from '../../services/bulkAdminService';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar, BulkConfirmModal } from '../../components/admin/BulkActionComponents';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import WorkerCard from '../../components/workers/WorkerCard';
import { formatDate } from '../../utils/formatters';
import {
  FileText, UserCheck, Star, Search, ChevronDown, Filter, RotateCcw,
  Trash2, RotateCcw as RestoreIcon, AlertOctagon, Printer,
} from 'lucide-react';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

// ── Helper ──────────────────────────────────────────────────────────────────
const daysRemaining = (permanentDeleteAt) => {
  if (!permanentDeleteAt) return null;
  return Math.ceil((new Date(permanentDeleteAt) - new Date()) / (1000 * 60 * 60 * 24));
};

export const AdminApplications = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  const [searchParams] = useSearchParams();

  // ── View (active / trash) ────────────────────────────────────────────────
  const [view, setView] = useState('active'); // 'active' | 'trash'

  // ── Active applications state ────────────────────────────────────────────
  const [applications, setApplications] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);

  // ── Trash state ──────────────────────────────────────────────────────────
  const [trashApps, setTrashApps] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // ── Filters (active tab) ─────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  // ── Trash search ─────────────────────────────────────────────────────────
  const [trashSearchQuery, setTrashSearchQuery] = useState('');

  // ── Confirmation modals state ─────────────────────────────────────────────
  const [selectedApp, setSelectedApp] = useState(null);             // view profile
  const [deleteTarget, setDeleteTarget] = useState(null);           // soft-delete confirm
  const [restoreTarget, setRestoreTarget] = useState(null);         // restore confirm
  const [permDeleteTarget, setPermDeleteTarget] = useState(null);   // permanent delete confirm
  const [actionLoading, setActionLoading] = useState(false);

  // ── Bulk confirmation & loading ───────────────────────────────────────────
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchActive = useCallback(async () => {
    setLoadingActive(true);
    const res = await applicationService.getAllApplications();
    if (res?.success) setApplications(res.data);
    else showToast(res?.message || 'Failed to load applications', 'error');
    setLoadingActive(false);
  }, []);

  const fetchTrash = useCallback(async () => {
    setLoadingTrash(true);
    const res = await applicationService.getTrashApplications();
    if (res?.success) setTrashApps(res.data);
    else showToast(res?.message || 'Failed to load trash', 'error');
    setLoadingTrash(false);
  }, []);

  const refreshBoth = useCallback(() => {
    fetchActive();
    fetchTrash();
  }, [fetchActive, fetchTrash]);

  useEffect(() => {
    fetchActive();
    fetchTrash();
  }, []);

  // ── Approve / Reject (existing workflow, unchanged) ───────────────────────
  const handleApproveAssign = async (appId) => {
    try {
      const res = await applicationService.approveAndAssignWorker(appId, adminUser);
      if (res.success) {
        showToast('Worker approved and assigned to event!', 'success');
        fetchActive();
      } else {
        showToast(res.message || 'Assignment failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error assigning worker', 'error');
    }
  };

  const handleReject = async (appId) => {
    try {
      const res = await applicationService.rejectApplication(appId, adminUser);
      if (res.success) {
        showToast('Application rejected.', 'info');
        fetchActive();
      }
    } catch (err) {
      showToast('Error rejecting application', 'error');
    }
  };

  const handleStatusChange = async (appId, newStatus) => {
    try {
      const res = await applicationService.updateApplicationStatus(appId, newStatus);
      if (res.success) {
        showToast('Application status updated.', 'success');
        fetchActive();
      } else {
        showToast(res.message || 'Error updating status', 'error');
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    }
  };

  // ── Trash lifecycle handlers ──────────────────────────────────────────────
  const confirmSoftDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    const res = await applicationService.softDeleteApplication(deleteTarget._id);
    setActionLoading(false);
    setDeleteTarget(null);
    if (res?.success) {
      showToast('Application moved to Trash.', 'success');
      refreshBoth();
    } else {
      showToast(res?.message || 'Failed to move to trash', 'error');
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    const res = await applicationService.restoreApplication(restoreTarget._id);
    setActionLoading(false);
    setRestoreTarget(null);
    if (res?.success) {
      showToast('Application restored.', 'success');
      refreshBoth();
    } else {
      showToast(res?.message || 'Failed to restore', 'error');
    }
  };

  const confirmPermDelete = async () => {
    if (!permDeleteTarget) return;
    setActionLoading(true);
    const res = await applicationService.permanentDeleteApplication(permDeleteTarget._id);
    setActionLoading(false);
    setPermDeleteTarget(null);
    if (res?.success) {
      showToast('Application permanently deleted.', 'info');
      fetchTrash();
    } else {
      showToast(res?.message || 'Failed to permanently delete', 'error');
    }
  };

  // ── Filtering (active tab) ────────────────────────────────────────────────
  const eventOptions = useMemo(() => {
    const names = new Set();
    applications.forEach((app) => {
      const title = app.jobId?.title;
      if (title) names.add(title);
    });
    return Array.from(names).sort();
  }, [applications]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    eventFilter !== 'ALL' ||
    dateFilter.preset !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setEventFilter('ALL');
    setDateFilter(DEFAULT_DATE_FILTER);
  };

  const visibleApps = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return applications.filter((app) => {
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
      if (eventFilter !== 'ALL' && app.jobId?.title !== eventFilter) return false;
      const appDate = app.appliedAt || app.createdAt;
      if (!matchesDateFilter(appDate, dateFilter)) return false;
      if (query) {
        const workerName = (app.workerProfile?.fullName || '').toLowerCase();
        const workerEmail = (app.workerProfile?.email || '').toLowerCase();
        const jobTitle = (app.jobId?.title || '').toLowerCase();
        const location = (app.workerProfile?.location || '').toLowerCase();
        const skills = (app.workerProfile?.skills || []).join(' ').toLowerCase();
        const searchable = `${workerName} ${workerEmail} ${jobTitle} ${location} ${skills}`;
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
  }, [applications, statusFilter, eventFilter, searchQuery, dateFilter]);

  const statusCounts = useMemo(() => {
    const baseList = applications.filter((app) => {
      if (eventFilter !== 'ALL' && app.jobId?.title !== eventFilter) return false;
      const appDate = app.appliedAt || app.createdAt;
      if (!matchesDateFilter(appDate, dateFilter)) return false;
      return true;
    });
    return {
      ALL: baseList.length,
      APPLIED: baseList.filter((a) => a.status === 'APPLIED').length,
      APPROVED: baseList.filter((a) => a.status === 'APPROVED').length,
      REJECTED: baseList.filter((a) => a.status === 'REJECTED').length,
    };
  }, [applications, eventFilter, dateFilter]);

  // ── Trash filtering ───────────────────────────────────────────────────────
  const visibleTrashApps = useMemo(() => {
    const query = trashSearchQuery.toLowerCase().trim();
    return trashApps.filter((app) => {
      const appDate = app.appliedAt || app.createdAt;
      if (!matchesDateFilter(appDate, dateFilter)) return false;
      if (!query) return true;
      const workerName = (app.workerProfile?.fullName || '').toLowerCase();
      const workerEmail = (app.workerProfile?.email || '').toLowerCase();
      const jobTitle = (app.jobId?.title || '').toLowerCase();
      const skills = (app.workerProfile?.skills || []).join(' ').toLowerCase();
      return `${workerName} ${workerEmail} ${jobTitle} ${skills}`.includes(query);
    });
  }, [trashApps, trashSearchQuery, dateFilter]);

  const statusOptions = [
    { v: 'ALL', l: 'All' },
    { v: 'APPLIED', l: 'Pending' },
    { v: 'APPROVED', l: 'Approved' },
    { v: 'REJECTED', l: 'Rejected' },
  ];

  // ── Bulk selection hooks (placed after visible arrays) ─────────────────────
  const bulkActive = useBulkSelection(visibleApps);
  const bulkTrash  = useBulkSelection(visibleTrashApps);

  // ── Bulk action executor ─────────────────────────────────────────────────
  const executeBulkApp = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const isTrash = bulkConfirm.target === 'trash';
    const ids = isTrash ? bulkTrash.selectedIdsArray : bulkActive.selectedIdsArray;
    let res;
    if (bulkConfirm.action === 'delete') res = await bulkAdminService.bulkDeleteApplications(ids);
    else if (bulkConfirm.action === 'restore') res = await bulkAdminService.bulkRestoreApplications(ids);
    else if (bulkConfirm.action === 'permanent') res = await bulkAdminService.bulkPermanentDeleteApplications(ids);
    setBulkLoading(false);
    setBulkConfirm(null);
    if (res?.success) {
      showToast(res.message, 'success');
      isTrash ? bulkTrash.clearSelection() : bulkActive.clearSelection();
      refreshBoth();
    } else {
      showToast(res?.message || 'Bulk action failed', 'error');
    }
  };

  // ── Print / Save PDF export — complete application details ───────────────
  const handleExportPdf = (isTrash = false) => {
    const list = isTrash ? visibleTrashApps : visibleApps;
    const bulkObj = isTrash ? bulkTrash : bulkActive;
    const selected = list.filter((a) => bulkObj.isSelected(a._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanSectionName = isTrash ? 'Applications_Trash' : 'Applications';
    exportDetailedRecordsToPdf({
      title: isTrash ? 'Applications (Trash)' : 'Worker Applications',
      subtitle: isTrash ? 'Deleted Applications Archive' : `Status: ${statusFilter} | Event: ${eventFilter} — ${dateStr}`,
      filename: `JobbyHop_${cleanSectionName}_${dateStr}.pdf`,
      records: selected,
      buildCard: (a) => [
        {
          heading: 'Worker Profile',
          color: '#8b5cf6',
          photo: a.workerProfile?.profilePhoto || a.workerId?.profilePhoto,
          rows: [
            ['Worker Name',     a.workerProfile?.fullName || a.workerId?.fullName || a.workerId?.name || a.workerId?.email],
            ['Email',           a.workerProfile?.email || a.workerId?.email],
            ['Phone',           a.workerProfile?.phone || a.workerId?.phone],
            ['Location',        a.workerProfile?.location],
            ['Skills',          (a.workerProfile?.skills || []).join(', ')],
            ['Rating',          a.workerProfile?.rating != null ? `${a.workerProfile.rating}/5` : null],
            ['Worker ID',       a.workerId?._id || a.workerId],
          ],
        },
        {
          heading: 'Job / Event Applied For',
          color: '#06b6d4',
          rows: [
            ['Event Title',      a.jobId?.title],
            ['Event Type',       a.jobId?.eventType],
            ['Event Date',       formatDate(a.jobId?.eventDate)],
            ['Start Time',       a.jobId?.startTime],
            ['End Time',         a.jobId?.endTime],
            ['Location',         getLocationString(a.jobId?.location)],
            ['Venue / Address',  typeof a.jobId?.location === 'object' ? (a.jobId?.location?.venue || a.jobId?.location?.address) : null],
            ['Workers Required', a.jobId?.workersRequired],
            ['Approved Pay',     formatCurrency(a.jobId?.adminApprovedPayment)],
            ['Job ID',           a.jobId?._id || a.jobId],
          ],
        },
        {
          heading: 'Application Details',
          color: '#10b981',
          rows: [
            ['Application Status', a.status],
            ['Applied At',         formatDate(a.createdAt)],
            ['Application ID',     a._id],
            ['Cover Note',         a.coverNote || a.message],
          ],
        },
        {
          heading: 'Recruiter Information',
          color: '#f59e0b',
          rows: [
            ['Recruiter Name',  a.jobId?.recruiterProfile?.fullName || a.jobId?.recruiterId?.fullName || a.jobId?.recruiterId?.email],
            ['Company',         a.jobId?.recruiterProfile?.companyName],
            ['Recruiter Email', a.jobId?.recruiterProfile?.email || a.jobId?.recruiterId?.email],
            ['Recruiter Phone', a.jobId?.recruiterProfile?.phone || a.jobId?.recruiterId?.phone],
          ],
        },
        ...(isTrash ? [{
          heading: 'Trash Information',
          color: '#ef4444',
          rows: [
            ['Deleted At',     formatDate(a.deletedAt)],
            ['Auto-Delete At', formatDate(a.permanentDeleteAt)],
          ],
        }] : []),
      ],
    });
  };


  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Worker Application Review ({applications.length})
          </h1>
          <p className="text-slate-400">Review worker profiles, skills, and assign qualified staff to events.</p>
        </div>
      </div>

      {/* Search + Filter Toolbar (shown on active tab only) */}
      {view === 'active' && (
        <div className="glass-card p-4 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, job, skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
              />
            </div>

            {/* Date Filter */}
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />

            <div className="relative min-w-[160px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all cursor-pointer"
              >
                {statusOptions.map(({ v, l }) => (
                  <option key={v} value={v}>{l} ({statusCounts[v]})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>

            {eventOptions.length > 0 && (
              <div className="relative min-w-[180px]">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all cursor-pointer"
                >
                  <option value="ALL">All Events</option>
                  {eventOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            )}

            {isFiltered && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trash search (shown on trash tab only) */}
      {view === 'trash' && (
        <div className="glass-card p-4 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search trashed applications..."
                value={trashSearchQuery}
                onChange={(e) => setTrashSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
              />
            </div>
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </div>
        </div>
      )}

      {/* Tabs: Active Applications / Trash */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setView('active')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            view === 'active'
              ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Active Applications ({applications.length})
        </button>
        <button
          onClick={() => setView('trash')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            view === 'trash'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Trash{trashApps.length > 0 ? ` (${trashApps.length})` : ''}
        </button>
      </div>

      {/* ── ACTIVE TAB ─────────────────────────────────────────────────────── */}
      {view === 'active' && (
        <>
          {isFiltered && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
              <span>
                Showing <span className="text-white font-bold">{visibleApps.length}</span> of{' '}
                <span className="text-white font-bold">{applications.length}</span> applications
              </span>
              {searchQuery.trim() && (
                <span className="text-slate-500">
                  · matching <span className="text-brand-300 font-semibold">"{searchQuery.trim()}"</span>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="text-slate-500">
                  · status <span className="text-emerald-400 font-semibold">{statusFilter}</span>
                </span>
              )}
              {eventFilter !== 'ALL' && (
                <span className="text-slate-500">
                  · event <span className="text-purple-400 font-semibold">{eventFilter}</span>
                </span>
              )}
            </div>
          )}

          {loadingActive ? (
            <LoadingSpinner label="Loading worker application queue..." />
          ) : visibleApps.length === 0 ? (
            <EmptyState
              title={isFiltered ? 'No Matching Applications' : 'No Applications'}
              description={
                isFiltered
                  ? 'No applications match your current search or filters. Try adjusting them or click Clear Filters.'
                  : 'No worker applications have been submitted yet.'
              }
            />
          ) : (
            <div className="space-y-2">
              {/* Bulk toolbar */}
              <BulkActionToolbar
                selectedCount={bulkActive.selectedCount}
                onClear={bulkActive.clearSelection}
                visible={bulkActive.selectedCount > 0}
                actions={[
                  { label: 'Print / Save PDF', icon: Printer, onClick: () => handleExportPdf(false) },
                  { label: 'Delete Selected', icon: Trash2, onClick: () => setBulkConfirm({ target: 'active', action: 'delete', label: 'Move to Trash', desc: `Move ${bulkActive.selectedCount} application(s) to trash?`, isDanger: false }), variant: 'danger' },
                ]}
              />
              {/* Table Header (desktop only) */}
              <div className="hidden md:grid md:grid-cols-[auto_2.5fr_2fr_1.2fr_1fr_1.2fr_auto] gap-4 px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <BulkCheckbox
                  id="app-active-select-all"
                  checked={bulkActive.isAllSelected}
                  indeterminate={bulkActive.isIndeterminate}
                  onChange={() => bulkActive.isAllSelected ? bulkActive.clearSelection() : bulkActive.selectAll()}
                />
                <span>Worker</span>
                <span>Job / Event</span>
                <span>Applied</span>
                <span>Rating</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>

              {visibleApps.map((app) => (
                <div
                  key={app._id}
                  className={`glass-card glass-card-hover rounded-xl border px-5 py-3.5 md:grid md:grid-cols-[auto_2.5fr_2fr_1.2fr_1fr_1.2fr_auto] md:items-center gap-4 flex flex-col transition-colors ${
                    bulkActive.isSelected(app._id) ? 'border-brand-500/40 bg-brand-500/5' : 'border-slate-800'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <BulkCheckbox
                      id={`app-cb-${app._id}`}
                      checked={bulkActive.isSelected(app._id)}
                      onChange={() => bulkActive.toggleSelection(app._id)}
                    />
                  </div>
                  {/* Worker */}
                  <div className="flex items-center gap-3">
                    <img
                      src={app.workerProfile?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={app.workerProfile?.fullName}
                      className="w-9 h-9 rounded-lg object-cover border border-brand-500/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{app.workerProfile?.fullName || 'Worker'}</p>
                      <p className="text-slate-500 text-[10px] truncate">{app.workerProfile?.location || ''}</p>
                    </div>
                  </div>

                  {/* Job / Event */}
                  <div className="min-w-0">
                    <span className="md:hidden text-slate-500 text-[10px] uppercase font-bold mr-1">Job: </span>
                    <p className="font-semibold text-slate-200 text-xs truncate">{app.jobId?.title || 'Job'}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(app.workerProfile?.skills || []).slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-300 text-[9px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Applied Date */}
                  <div>
                    <span className="md:hidden text-slate-500 text-[10px] uppercase font-bold mr-1">Applied: </span>
                    <p className="text-slate-300 text-xs">{formatDate(app.appliedAt)}</p>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    <span className="md:hidden text-slate-500 text-[10px] uppercase font-bold mr-1">Rating: </span>
                    {app.workerProfile?.rating != null && app.workerProfile.rating >= 1 && app.workerProfile.rating <= 5 ? (
                      <>
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-white font-bold text-xs">{app.workerProfile.rating}</span>
                      </>
                    ) : (
                      <span className="text-slate-500 font-bold text-xs">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex flex-col gap-1.5 items-start">
                    <StatusBadge status={app.status} />
                    <div className="relative inline-block">
                      <select
                        className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-[10px] font-bold py-1 pl-2 pr-6 rounded-md focus:outline-none focus:border-brand-500 cursor-pointer transition-colors"
                        value={['APPROVED', 'SUSPENDED', 'REJECTED', 'COMPLETED'].includes(app.status) ? app.status : ''}
                        onChange={(e) => handleStatusChange(app._id, e.target.value)}
                      >
                        <option value="" disabled>Update Status...</option>
                        <option value="APPROVED">Approved & Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-[11px] whitespace-nowrap transition-colors"
                    >
                      View Profile
                    </button>

                    {app.status === 'APPLIED' && (
                      <>
                        <button
                          onClick={() => handleReject(app._id)}
                          className="px-3 py-1.5 rounded-xl text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 font-semibold text-[11px] whitespace-nowrap transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveAssign(app._id)}
                          className="gradient-btn px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-[11px] whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Approve & Assign
                        </button>
                      </>
                    )}

                    {/* Trash / soft-delete */}
                    <button
                      onClick={() => setDeleteTarget(app)}
                      title="Move to Trash"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TRASH TAB ──────────────────────────────────────────────────────── */}
      {view === 'trash' && (
        <>
          {loadingTrash ? (
            <LoadingSpinner label="Loading trash..." />
          ) : visibleTrashApps.length === 0 ? (
            <EmptyState
              title="Trash is Empty"
              description={trashSearchQuery ? 'No trashed applications match your search.' : 'No deleted applications.'}
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
              {/* Trash Bulk toolbar */}
              <div className="p-3">
                <BulkActionToolbar
                  selectedCount={bulkTrash.selectedCount}
                  onClear={bulkTrash.clearSelection}
                  visible={bulkTrash.selectedCount > 0}
                  actions={[
                    { label: 'Print / Save PDF', icon: Printer, onClick: () => handleExportPdf(true) },
                    { label: 'Restore Selected', icon: RestoreIcon, onClick: () => setBulkConfirm({ target: 'trash', action: 'restore', label: 'Restore', desc: `Restore ${bulkTrash.selectedCount} application(s) from trash?`, isDanger: false }) },
                    { label: 'Permanently Delete', icon: Trash2, onClick: () => setBulkConfirm({ target: 'trash', action: 'permanent', label: 'Permanently Delete', desc: `Permanently delete ${bulkTrash.selectedCount} application(s)? This cannot be undone.`, isDanger: true }), variant: 'danger' },
                  ]}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <BulkCheckbox
                          id="app-trash-select-all"
                          checked={bulkTrash.isAllSelected}
                          indeterminate={bulkTrash.isIndeterminate}
                          onChange={() => bulkTrash.isAllSelected ? bulkTrash.clearSelection() : bulkTrash.selectAll()}
                        />
                      </th>
                      <th className="px-4 py-3">Worker</th>
                      <th className="px-4 py-3">Job / Event</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Deleted</th>
                      <th className="px-4 py-3">Auto-Delete</th>
                      <th className="px-4 py-3">Days Left</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {visibleTrashApps.map((app) => {
                      const days = daysRemaining(app.permanentDeleteAt);
                      return (
                        <tr key={app._id} className={`hover:bg-slate-800/40 transition-colors ${bulkTrash.isSelected(app._id) ? 'bg-brand-500/5' : ''}`}>
                          <td className="px-4 py-3.5 w-10">
                            <BulkCheckbox
                              id={`app-trash-cb-${app._id}`}
                              checked={bulkTrash.isSelected(app._id)}
                              onChange={() => bulkTrash.toggleSelection(app._id)}
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <img
                                src={app.workerProfile?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                alt={app.workerProfile?.fullName}
                                className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0"
                              />
                              <div>
                                <p className="font-bold text-white text-xs">{app.workerProfile?.fullName || 'Worker'}</p>
                                <p className="text-slate-500 text-[10px]">{app.workerProfile?.email || app.workerId?.email || ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-200 text-xs">{app.jobId?.title || '—'}</p>
                            <p className="text-slate-500 text-[10px]">{app.jobId?.eventType || ''}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={app.status} />
                            <div className="mt-1 text-[10px] text-slate-500 uppercase font-bold tracking-widest">Previous</div>
                          </td>
                          <td className="px-4 py-3.5 text-rose-400 font-semibold text-xs">
                            {formatDate(app.deletedAt)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs">
                            {formatDate(app.permanentDeleteAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            {days !== null && days > 0 && days <= 7 ? (
                              <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px]">
                                <AlertOctagon className="w-3 h-3" /> {days}d
                              </div>
                            ) : days !== null && days > 0 ? (
                              <span className="text-slate-400 text-[11px]">{days}d</span>
                            ) : (
                              <span className="text-rose-400 text-[11px] font-bold">Expired</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 justify-end flex-wrap">
                              <button
                                onClick={() => setRestoreTarget(app)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <RestoreIcon className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => setPermDeleteTarget(app)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Forever
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
        </>
      )}

      {/* Bulk Trash toolbar — shown below trash list when items selected */}
      {view === 'trash' && bulkTrash.selectedCount > 0 && (
        <BulkActionToolbar
          selectedCount={bulkTrash.selectedCount}
          onClear={bulkTrash.clearSelection}
          visible={true}
          actions={[
            { label: 'Restore Selected', icon: RestoreIcon, onClick: () => setBulkConfirm({ target: 'trash', action: 'restore', label: 'Restore', desc: `Restore ${bulkTrash.selectedCount} application(s)?`, isDanger: false }) },
            { label: 'Delete Forever', icon: Trash2, onClick: () => setBulkConfirm({ target: 'trash', action: 'permanent', label: 'Permanently Delete', desc: 'This permanently removes the selected applications. Cannot be undone.', isDanger: true }), variant: 'danger' },
          ]}
        />
      )}

      {/* ── Profile Detail Modal (unchanged) ──────────────────────────────── */}
      {selectedApp && (
        <Modal
          isOpen={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          title={`Worker Application Profile: ${selectedApp.workerProfile?.fullName}`}
        >
          <div className="space-y-4 text-xs">
            <WorkerCard workerProfile={selectedApp.workerProfile} />
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <p className="font-bold text-white">Experience Summary:</p>
              <p className="text-slate-300">{selectedApp.workerProfile?.experience || 'None'}</p>
              <p className="font-bold text-white pt-2">Previous Event Highlights:</p>
              <p className="text-slate-300">{selectedApp.workerProfile?.previousEventExperience || 'None'}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Soft Delete Confirm Modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Move Application to Trash?"
        >
          <div className="space-y-5 text-xs">
            <p className="text-slate-300">
              This application from{' '}
              <span className="text-white font-bold">{deleteTarget.workerProfile?.fullName || 'this worker'}</span>
              {' '}for <span className="text-white font-bold">{deleteTarget.jobId?.title || 'this event'}</span> will
              remain in Trash for 30 days before permanent deletion.
            </p>
            <p className="text-slate-400">
              The application's status (<StatusBadge status={deleteTarget.status} />) and all business data will be preserved.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSoftDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {actionLoading ? 'Moving...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Restore Confirm Modal ──────────────────────────────────────────── */}
      {restoreTarget && (
        <Modal
          isOpen={Boolean(restoreTarget)}
          onClose={() => setRestoreTarget(null)}
          title="Restore Application?"
        >
          <div className="space-y-5 text-xs">
            <p className="text-slate-300">
              This application from{' '}
              <span className="text-white font-bold">{restoreTarget.workerProfile?.fullName || 'this worker'}</span>
              {' '}will be moved back to Active Applications with its original status intact.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RestoreIcon className="w-3.5 h-3.5" />
                {actionLoading ? 'Restoring...' : 'Restore Application'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Permanent Delete Confirm Modal ────────────────────────────────── */}
      {permDeleteTarget && (
        <Modal
          isOpen={Boolean(permDeleteTarget)}
          onClose={() => setPermDeleteTarget(null)}
          title="Delete Application Forever?"
        >
          <div className="space-y-5 text-xs">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <p className="text-rose-300 font-bold">⚠️ This action cannot be undone.</p>
              <p className="text-rose-200/80 mt-1">
                This application will be permanently deleted and cannot be restored.
              </p>
            </div>
            <p className="text-slate-400">
              Application from{' '}
              <span className="text-white font-bold">{permDeleteTarget.workerProfile?.fullName || 'this worker'}</span>
              {' '}for{' '}
              <span className="text-white font-bold">{permDeleteTarget.jobId?.title || 'this event'}</span>
              {' '}will be permanently removed from the database.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPermDeleteTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPermDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {actionLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Bulk Confirm Modal ── */}
      {bulkConfirm && (
        <BulkConfirmModal
          open={true}
          onClose={() => setBulkConfirm(null)}
          onConfirm={executeBulkApp}
          count={bulkConfirm.target === 'trash' ? bulkTrash.selectedCount : bulkActive.selectedCount}
          actionLabel={bulkConfirm.label}
          description={bulkConfirm.desc}
          loading={bulkLoading}
          isDanger={bulkConfirm.isDanger !== false}
        />
      )}
    </div>
  );
};

export default AdminApplications;
