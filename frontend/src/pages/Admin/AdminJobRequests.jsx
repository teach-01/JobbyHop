import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import jobService from '../../services/jobService';
import bulkAdminService from '../../services/bulkAdminService';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar, BulkSelectAllRow, BulkConfirmModal } from '../../components/admin/BulkActionComponents';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import JobApprovalModal from '../../components/admin/JobApprovalModal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  ShieldCheck, AlertTriangle, Briefcase, Search, ChevronDown, Filter,
  ChevronLeft, ChevronRight, RotateCcw, XCircle, CheckCircle, Eye,
  MapPin, Calendar, Clock, Users, IndianRupee, FileText, X, ArrowUpDown, Trash2, AlertOctagon, Printer
} from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, getDateRangeBoundaries, matchesDateFilter } from '../../utils/dateFilterHelper';

const ITEMS_PER_PAGE = 10;

export const AdminJobRequests = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalDocs: 0, totalPages: 1, limit: ITEMS_PER_PAGE });
  const [statusCounts, setStatusCounts] = useState({ PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0 });
  const [trashCount, setTrashCount] = useState(0);

  // Filter/search state
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  // Modal state
  const [selectedJob, setSelectedJob] = useState(null);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'approve', 'reject'
  const [approvePayment, setApprovePayment] = useState(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve' | 'reject', jobId }
  const [submitting, setSubmitting] = useState(false);

  // Bulk selection
  const bulk = useBulkSelection(jobs);
  const [bulkConfirm, setBulkConfirm] = useState(null); // { action: 'delete'|'restore'|'permanent', label, desc }
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch jobs from backend with current filters
  const fetchJobs = useCallback(async (page = currentPage) => {
    setLoading(true);
    if (statusFilter === 'TRASH') {
      const res = await jobService.getTrashJobs();
      if (res.success) {
        let trashData = res.data || [];
        if (searchQuery.trim()) {
          const lowerQ = searchQuery.toLowerCase();
          trashData = trashData.filter(j => 
            j.title?.toLowerCase().includes(lowerQ) ||
            getLocationString(j.location).toLowerCase().includes(lowerQ) ||
            j.recruiterProfile?.fullName?.toLowerCase().includes(lowerQ) ||
            j._id?.toLowerCase().includes(lowerQ)
          );
        }
        if (dateFilter.preset !== 'all') {
          trashData = trashData.filter(j => matchesDateFilter(j.createdAt, dateFilter));
        }
        setJobs(trashData);
        setPagination({ page: 1, totalDocs: trashData.length, totalPages: 1, limit: trashData.length });
      }
      setLoading(false);
      return;
    }

    const params = {
      status: statusFilter,
      page,
      limit: ITEMS_PER_PAGE,
      sort: sortOrder,
    };
    if (searchQuery.trim()) params.search = searchQuery.trim();
    const range = getDateRangeBoundaries(dateFilter);
    if (range) {
      params.createdFrom = new Date(range.start).toISOString();
      params.createdTo = new Date(range.end).toISOString();
    }

    const res = await jobService.getAllJobs(params);
    if (res.success) {
      setJobs(res.data);
      if (res.pagination) setPagination(res.pagination);
      if (res.statusCounts) setStatusCounts(res.statusCounts);
    }
    setLoading(false);
  }, [statusFilter, searchQuery, sortOrder, currentPage, dateFilter]);

  const fetchTrashCount = async () => {
    const res = await jobService.getTrashJobs();
    if (res.success) setTrashCount(res.data?.length || 0);
  };

  useEffect(() => {
    fetchTrashCount();
  }, []);

  // Re-fetch when filters, sort, page, or date filter change
  useEffect(() => {
    fetchJobs(currentPage);
  }, [statusFilter, sortOrder, currentPage, dateFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchJobs(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tab change
  const handleTabChange = (status) => {
    setStatusFilter(status);
    setSearchParams({ status });
    setCurrentPage(1);
  };

  // Sync state if URL changes directly
  useEffect(() => {
    const status = searchParams.get('status');
    if (status && status !== statusFilter) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  // Open detail modal
  const openJobModal = (job, mode = 'view') => {
    setSelectedJob(job);
    setModalMode(mode);
    setApprovePayment(job.adminApprovedPayment || job.recruiterProposedPayment || 0);
    setAdminNotes(job.adminNotes || '');
    setRejectionReason('');
    setConfirmAction(null);
  };

  // Trash actions
  const handleSoftDelete = async (job) => {
    if (window.confirm(`Move "${job.title}" to Trash?`)) {
      const res = await jobService.softDeleteJob(job._id);
      if (res.success) {
        showToast('Job Request moved to Trash.', 'success');
        fetchJobs(currentPage);
        fetchTrashCount();
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  const handleRestore = async (job) => {
    const res = await jobService.restoreJob(job._id);
    if (res.success) {
      showToast('Job Request restored successfully.', 'success');
      fetchJobs(currentPage);
      fetchTrashCount();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeletePermanentClick = (job) => {
    setSelectedJob(job);
    setConfirmAction({ type: 'permanent_delete', jobId: job._id });
  };

  const confirmPermanentDelete = async () => {
    if (!selectedJob) return;
    setSubmitting(true);
    const res = await jobService.permanentDeleteJob(selectedJob._id);
    if (res.success) {
      showToast('Job Request permanently deleted.', 'success');
      setConfirmAction(null);
      setSelectedJob(null);
      fetchJobs(currentPage);
      fetchTrashCount();
    } else {
      showToast(res.message, 'error');
    }
    setSubmitting(false);
  };

  // Handle approve
  const handleApprove = async () => {
    if (!selectedJob) return;
    if (approvePayment <= 0) {
      showToast('Please set a valid approved payment amount.', 'error');
      return;
    }
    // Show confirmation first
    setConfirmAction({ type: 'approve', jobId: selectedJob._id });
  };

  const confirmApprove = async () => {
    setSubmitting(true);
    try {
      const formData = {
        title: selectedJob.title,
        description: selectedJob.description,
        eventType: selectedJob.eventType,
        eventDate: selectedJob.eventDate ? selectedJob.eventDate.split('T')[0] : '',
        startTime: selectedJob.startTime,
        endTime: selectedJob.endTime,
        location: selectedJob.location,
        workersRequired: selectedJob.workersRequired,
        adminApprovedPayment: Number(approvePayment),
        adminNotes,
        action: 'APPROVE',
      };
      const res = await jobService.reviewJobByAdmin(selectedJob._id, formData, adminUser);
      if (res.success) {
        showToast('Job request successfully APPROVED!', 'success');
        setSelectedJob(null);
        setConfirmAction(null);
        fetchJobs(currentPage);
      } else {
        showToast(res.message || 'Approval failed', 'error');
      }
    } catch (err) {
      showToast('Failed to approve job request', 'error');
    }
    setSubmitting(false);
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedJob) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason.', 'error');
      return;
    }
    setConfirmAction({ type: 'reject', jobId: selectedJob._id });
  };

  const confirmReject = async () => {
    setSubmitting(true);
    try {
      const formData = {
        title: selectedJob.title,
        description: selectedJob.description,
        eventType: selectedJob.eventType,
        eventDate: selectedJob.eventDate ? selectedJob.eventDate.split('T')[0] : '',
        startTime: selectedJob.startTime,
        endTime: selectedJob.endTime,
        location: selectedJob.location,
        workersRequired: selectedJob.workersRequired,
        adminApprovedPayment: selectedJob.recruiterProposedPayment,
        adminNotes: rejectionReason,
        action: 'REJECT',
      };
      const res = await jobService.reviewJobByAdmin(selectedJob._id, formData, adminUser);
      if (res.success) {
        showToast('Job request REJECTED.', 'info');
        setSelectedJob(null);
        setConfirmAction(null);
        fetchJobs(currentPage);
      } else {
        showToast(res.message || 'Rejection failed', 'error');
      }
    } catch (err) {
      showToast('Failed to reject job request', 'error');
    }
    setSubmitting(false);
  };

  // Handle full review from JobApprovalModal (for updating rejected jobs)
  const handleFullReview = async (jobId, formData) => {
    setSubmitting(true);
    try {
      const res = await jobService.reviewJobByAdmin(jobId, formData, adminUser);
      if (res.success) {
        showToast(`Job request successfully ${formData.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}!`, 'success');
        setSelectedJob(null);
        setModalMode('view');
        fetchJobs(currentPage);
      } else {
        showToast(res.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Failed to process job request', 'error');
    }
    setSubmitting(false);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setSortOrder('newest');
    setDateFilter(DEFAULT_DATE_FILTER);
    setCurrentPage(1);
    handleTabChange('ALL');
  };

  // Bulk actions
  const executeBulkAction = async () => {
    if (!bulkConfirm || bulk.selectedCount === 0) return;
    setBulkLoading(true);
    const ids = bulk.selectedIdsArray;
    let res;
    if (bulkConfirm.action === 'delete') res = await bulkAdminService.bulkDeleteJobs(ids);
    else if (bulkConfirm.action === 'restore') res = await bulkAdminService.bulkRestoreJobs(ids);
    else if (bulkConfirm.action === 'permanent') res = await bulkAdminService.bulkPermanentDeleteJobs(ids);
    setBulkLoading(false);
    setBulkConfirm(null);
    if (res?.success) {
      showToast(res.message, 'success');
      bulk.clearSelection();
      fetchJobs(currentPage);
      fetchTrashCount();
    } else {
      showToast(res?.message || 'Bulk action failed', 'error');
    }
  };

  // Export selected to PDF
  const handleExportPdf = () => {
    const selectedJobs = jobs.filter((j) => bulk.isSelected(j._id));
    if (selectedJobs.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanSectionName = statusFilter === 'TRASH' ? 'Job_Requests_Trash' : 'Job_Requests';
    exportDetailedRecordsToPdf({
      title: 'Job Requests Queue',
      subtitle: statusFilter === 'TRASH' ? `Deleted Job Requests Archive — ${dateStr}` : `Status: ${statusFilter} — ${dateStr}`,
      filename: `JobbyHop_${cleanSectionName}_${dateStr}.pdf`,
      records: selectedJobs,
      buildCard: (j) => [
        {
          heading: 'Recruiter / Agency Information',
          color: '#8b5cf6',
          rows: [
            ['Recruiter Name',  j.recruiterProfile?.fullName || j.recruiterId?.fullName || j.recruiterId?.email],
            ['Company',         j.recruiterProfile?.companyName],
            ['Recruiter Email', j.recruiterProfile?.email || j.recruiterId?.email],
            ['Recruiter Phone', j.recruiterProfile?.phone || j.recruiterId?.phone],
          ],
        },
        {
          heading: 'Event / Job Details',
          color: '#06b6d4',
          rows: [
            ['Job Title',        j.title],
            ['Event Type',       j.eventType],
            ['Event Date',       formatDate(j.eventDate)],
            ['Start Time',       j.startTime],
            ['End Time',         j.endTime],
            ['Location / Venue', getLocationString(j.location)],
            ['Venue / Address',  typeof j.location === 'object' ? (j.location.venue || j.location.address) : null],
            ['Workers Required', j.workersRequired],
            ['Description',      j.description],
            ['Required Skills',  (j.requiredSkills || []).length > 0 ? (j.requiredSkills || []).join(', ') : null],
            ['Responsibilities', j.responsibilities],
            ['Instructions',     j.additionalInstructions],
            ['Job ID',           j._id],
          ],
        },
        {
          heading: 'Payment Information',
          color: '#10b981',
          rows: [
            ['Recruiter Proposed Pay (per person)', formatCurrency(j.recruiterProposedPayment)],
            ['Total Offer Amount',                  formatCurrency(j.offeredTotalAmount ?? (j.recruiterProposedPayment * j.workersRequired))],
            ['Admin Approved Pay (per person)',     formatCurrency(j.adminApprovedPayment)],
          ],
        },
        {
          heading: 'Admin Review',
          color: '#f59e0b',
          rows: [
            ['Current Status',          j.status],
            ['Admin Notes',             j.adminNotes],
            ['Submitted At',            formatDate(j.createdAt)],
            ['Accepted / Approved At',  formatDate(j.acceptedAt)],
            ...(statusFilter === 'TRASH' ? [
              ['Deleted At',            formatDate(j.deletedAt)],
              ['Auto-Delete At',        formatDate(j.permanentDeleteAt)],
            ] : []),
          ],
        },
      ],
    });
  };

  // Helpers
  const getRecruiterName = (job) => job.recruiterProfile?.fullName || job.recruiterId?.email || 'Unknown Recruiter';
  const getRecruiterEmail = (job) => job.recruiterProfile?.email || job.recruiterId?.email || '';
  const getRecruiterPhone = (job) => job.recruiterProfile?.phone || job.recruiterId?.phone || '';
  const getCompanyName = (job) => job.recruiterProfile?.companyName || '';

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Job Approval Requests Queue</h1>
          <p className="text-slate-400">Review event details, adjust worker payments, and publish jobs to workers.</p>
        </div>
      </div>

      {/* Search + Filter Toolbar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs, recruiters, events, location, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
            />
          </div>

          {/* Date Filter */}
          <DateFilter
            dateFilter={dateFilter}
            onDateFilterChange={(newDf) => {
              setDateFilter(newDf);
              setCurrentPage(1);
            }}
          />

          {/* Sort */}
          <div className="relative min-w-[130px]">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>

          {/* Reset */}
          <button
            onClick={resetFilters}
            className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          {/* Trash */}
          <button
            onClick={() => handleTabChange('TRASH')}
            className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ml-auto ${
              statusFilter === 'TRASH' 
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30' 
                : 'bg-slate-800/80 text-slate-400 hover:text-rose-300 border border-slate-700/50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" /> 
            Trash {trashCount > 0 ? `(${trashCount})` : ''}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { v: 'ALL',            l: 'All', count: statusCounts.ALL || 0 },
          { v: 'PENDING_REVIEW', l: 'Pending Review', count: statusCounts.PENDING_REVIEW },
          { v: 'APPROVED',       l: 'Accepted / Approved', count: statusCounts.APPROVED },
          { v: 'REJECTED',       l: 'Rejected Jobs', count: statusCounts.REJECTED },
        ].map(({ v, l, count }) => (
          <button
            key={v}
            onClick={() => handleTabChange(v)}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              statusFilter === v
                ? v === 'APPROVED'
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : v === 'REJECTED'
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30'
                  : v === 'ALL'
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                  : 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {l}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${
              statusFilter === v ? 'bg-slate-800' : 'bg-slate-900'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Critical Business Rule Banner */}
      {statusFilter === 'TRASH' ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-300">Job Requests Trash</p>
            <p className="text-[11px] text-rose-200/90 mt-0.5">
              Deleted job requests are automatically permanently deleted after 30 days.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">Central Admin Payment & Publishing Rule:</p>
            <p className="text-[11px] text-amber-200/90 mt-0.5">
              Recruiter proposed pay (e.g. ₹1500) can be adjusted by Admin (e.g. ₹1000). Workers will ONLY see the final Admin-Approved payment. Jobs do not appear to workers until APPROVED here.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <LoadingSpinner label={statusFilter === 'TRASH' ? "Loading trash..." : "Loading job approval requests..."} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title={
            statusFilter === 'PENDING_REVIEW' ? 'No Pending Job Requests'
            : statusFilter === 'ALL' ? 'No Job Requests Found'
            : statusFilter === 'APPROVED' ? 'No Approved Jobs Yet'
            : statusFilter === 'TRASH' ? 'Trash is Empty'
            : 'No Rejected Job Requests'
          }
          description={
            statusFilter === 'PENDING_REVIEW'
              ? searchQuery ? 'No pending requests match your search.' : 'All recruiter job requests have been reviewed!'
              : statusFilter === 'ALL'
              ? searchQuery ? 'No job requests match your search.' : 'No active job requests.'
              : statusFilter === 'APPROVED'
              ? searchQuery ? 'No approved jobs match your search.' : 'Approved jobs will appear here after Admin accepts recruiter requests.'
              : statusFilter === 'TRASH'
              ? searchQuery ? 'No deleted jobs match your search.' : 'No deleted job requests.'
              : searchQuery ? 'No rejected jobs match your search.' : 'No rejected jobs found.'
          }
        />
      ) : (
        <>
          {/* Results count */}
          <div className="flex items-center justify-between text-slate-400 text-[11px] px-1">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalDocs)} of {pagination.totalDocs} results
            </span>
          </div>

          {/* Bulk toolbar */}
          <BulkActionToolbar
            selectedCount={bulk.selectedCount}
            onClear={bulk.clearSelection}
            visible={bulk.selectedCount > 0}
            actions={[
              { label: 'Print / Save PDF', icon: Printer, onClick: handleExportPdf },
              ...(statusFilter === 'TRASH' ? [
                { label: 'Restore Selected', icon: RotateCcw, onClick: () => setBulkConfirm({ action: 'restore', label: 'Restore', desc: `Restore ${bulk.selectedCount} job request(s) from trash?`, isDanger: false }) },
                { label: 'Permanently Delete', icon: Trash2, onClick: () => setBulkConfirm({ action: 'permanent', label: 'Permanently Delete', desc: 'This will permanently remove the selected job requests. This cannot be undone.', isDanger: true }), variant: 'danger' },
              ] : [
                { label: 'Delete Selected', icon: Trash2, onClick: () => setBulkConfirm({ action: 'delete', label: 'Move to Trash', desc: `Move ${bulk.selectedCount} job request(s) to trash?`, isDanger: false }), variant: 'danger' },
              ]),
            ]}
          />

          {/* Table */}
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <BulkCheckbox
                        id="job-select-all"
                        checked={bulk.isAllSelected}
                        indeterminate={bulk.isIndeterminate}
                        onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                      />
                    </th>
                    <th className="px-4 py-3">Recruiter / Agency</th>
                    <th className="px-4 py-3">Event Job Title</th>
                    <th className="px-4 py-3">Event Date & Venue</th>
                    <th className="px-4 py-3">Staff Needed</th>
                    <th className="px-4 py-3">Requested Pay</th>
                    {statusFilter === 'APPROVED' && <th className="px-4 py-3">Admin Approved Pay</th>}
                    {statusFilter === 'REJECTED' && <th className="px-4 py-3">Admin Pay</th>}
                    <th className="px-4 py-3">Status</th>
                    {statusFilter === 'TRASH' ? (
                      <th className="px-4 py-3">Deleted Info</th>
                    ) : (
                      <>
                        {statusFilter === 'REJECTED' && <th className="px-4 py-3">Rejection Reason</th>}
                        {statusFilter === 'APPROVED' && <th className="px-4 py-3">Approved At</th>}
                        <th className="px-4 py-3">Submitted</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {jobs.map((job) => (
                    <tr key={job._id} className={`hover:bg-slate-800/40 transition-colors ${bulk.isSelected(job._id) ? 'bg-brand-500/5' : ''}`}>
                      <td className="px-4 py-3.5 w-10">
                        <BulkCheckbox
                          id={`job-cb-${job._id}`}
                          checked={bulk.isSelected(job._id)}
                          onChange={() => bulk.toggleSelection(job._id)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <span className="font-bold text-white block">{getRecruiterName(job)}</span>
                          <span className="text-[10px] text-slate-500">{getRecruiterEmail(job)}</span>
                          {getCompanyName(job) && (
                            <span className="text-[10px] text-brand-400 block">{getCompanyName(job)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-white text-sm block">{job.title}</span>
                        <span className="text-[10px] text-brand-400 uppercase font-bold">{job.eventType}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          {formatDate(job.eventDate)}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-600" />
                          <span className="truncate max-w-[120px]">{getLocationString(job.location)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-purple-300">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {job.workersRequired} Staff
                        </div>
                      </td>
                      {/* Requested (recruiter's original rate) */}
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-amber-400">
                          {formatCurrency(job.offeredAmountPerPerson ?? job.recruiterProposedPayment)}
                          <span className="text-amber-500/60 font-normal">/person</span>
                        </div>
                        <div className="text-[10px] text-emerald-400/80 font-semibold mt-0.5">
                          Total: {formatCurrency(
                            job.offeredTotalAmount ??
                            ((job.offeredAmountPerPerson ?? job.recruiterProposedPayment) * job.workersRequired)
                          )}
                        </div>
                      </td>
                      {/* Admin Approved Pay — APPROVED tab */}
                      {statusFilter === 'APPROVED' && (
                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-emerald-400">
                            {job.adminApprovedPayment ? formatCurrency(job.adminApprovedPayment) : '—'}
                            {job.adminApprovedPayment && <span className="text-emerald-500/60 font-normal">/person</span>}
                          </div>
                          {job.adminApprovedPayment && (
                            <div className="text-[10px] text-emerald-400/60 mt-0.5">
                              Total: {formatCurrency(job.adminApprovedPayment * job.workersRequired)}
                            </div>
                          )}
                        </td>
                      )}
                      {/* Admin Pay — REJECTED tab */}
                      {statusFilter === 'REJECTED' && (
                        <td className="px-4 py-3.5 font-extrabold text-emerald-400">
                          {job.adminApprovedPayment ? formatCurrency(job.adminApprovedPayment) : '—'}
                        </td>
                      )}
                      {statusFilter === 'TRASH' ? (
                        <td className="px-4 py-3.5">
                          <StatusBadge status={job.status} />
                          <div className="mt-1 text-[10px] text-slate-500 uppercase font-bold tracking-widest">Previous</div>
                        </td>
                      ) : (
                        <td className="px-4 py-3.5">
                          <StatusBadge status={job.status} />
                        </td>
                      )}
                      
                      {statusFilter === 'TRASH' ? (
                        <td className="px-4 py-3.5">
                          <div className="text-rose-400 font-semibold">{formatDate(job.deletedAt)}</div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Auto-Delete: <span className="font-bold text-slate-400">{formatDate(job.permanentDeleteAt)}</span>
                          </div>
                          {(() => {
                            const days = Math.ceil((new Date(job.permanentDeleteAt) - new Date()) / (1000 * 60 * 60 * 24));
                            if (days > 0 && days <= 7) return <div className="text-[10px] text-amber-500 font-bold mt-0.5 flex items-center gap-1"><AlertOctagon className="w-3 h-3" /> {days} days remaining</div>;
                            return <div className="text-[10px] text-slate-500 mt-0.5">{days > 0 ? `${days} days remaining` : 'Expired'}</div>;
                          })()}
                        </td>
                      ) : (
                        <>
                          {statusFilter === 'REJECTED' && (
                            <td className="px-4 py-3.5 text-rose-300/80 max-w-[160px] truncate text-[11px]">
                              {job.adminNotes || 'No reason provided'}
                            </td>
                          )}
                          {statusFilter === 'APPROVED' && (
                            <td className="px-4 py-3.5 text-[10px] text-slate-400">
                              {job.acceptedAt ? (
                                <span className="text-emerald-400/80 font-semibold">{formatDateTime(job.acceptedAt)}</span>
                              ) : job.reviewedAt ? (
                                <span className="text-emerald-400/80 font-semibold">{formatDateTime(job.reviewedAt)}</span>
                              ) : '—'}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-slate-500 text-[10px]">
                            {formatDate(job.createdAt)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {/* View Details - always visible */}
                          <button
                            onClick={() => openJobModal(job, 'view')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>

                          {statusFilter === 'TRASH' ? (
                            <>
                              <button
                                onClick={() => handleRestore(job)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              <button
                                onClick={() => handleDeletePermanentClick(job)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Approve/Reject for pending */}
                              {job.status === 'PENDING_REVIEW' && (
                                <>
                                  <button
                                    onClick={() => openJobModal(job, 'approve')}
                                    className="gradient-btn px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    onClick={() => openJobModal(job, 'reject')}
                                    className="px-3 py-1.5 rounded-xl text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                </>
                              )}
                              {job.status === 'REJECTED' && (
                                <button
                                  onClick={() => openJobModal(job, 'edit')}
                                  className="px-3 py-1.5 rounded-xl text-brand-400 border border-brand-500/30 hover:bg-brand-950/40 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                                  title="Update and Re-Approve Job"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Update
                                </button>
                              )}
                              <button
                                onClick={() => handleSoftDelete(job)}
                                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-slate-500 text-[11px]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                {/* Page buttons */}
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[11px] font-bold transition-all ${
                        pageNum === pagination.page
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== JOB DETAIL / APPROVE / REJECT MODAL ==================== */}
      {selectedJob && modalMode !== 'edit' && (
        <Modal
          isOpen={Boolean(selectedJob)}
          onClose={() => { setSelectedJob(null); setConfirmAction(null); }}
          title={
            modalMode === 'approve' ? `Approve: ${selectedJob.title}`
            : modalMode === 'reject' ? `Reject: ${selectedJob.title}`
            : `Job Details: ${selectedJob.title}`
          }
          maxWidth="max-w-3xl"
        >
          {/* Confirmation overlay */}
          {confirmAction && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm rounded-2xl">
              <div className="p-6 max-w-sm text-center space-y-4">
                {confirmAction.type === 'approve' ? (
                  <>
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Confirm Approval</h3>
                    <p className="text-slate-400 text-sm">
                      Approve <strong className="text-white">"{selectedJob.title}"</strong> with final worker payment of{' '}
                      <strong className="text-emerald-400">{formatCurrency(approvePayment)}</strong>?
                    </p>
                    <p className="text-[11px] text-slate-500">This job will be published and visible to workers.</p>
                    <div className="flex gap-3 justify-center pt-2">
                      <button
                        onClick={() => setConfirmAction(null)}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmApprove}
                        disabled={submitting}
                        className="gradient-btn px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5"
                      >
                        {submitting ? 'Approving...' : <><ShieldCheck className="w-4 h-4" /> Yes, Approve</>}
                      </button>
                    </div>
                  </>
                ) : confirmAction.type === 'reject' ? (
                  <>
                    <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                      <XCircle className="w-7 h-7 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Confirm Rejection</h3>
                    <p className="text-slate-400 text-sm">
                      Reject <strong className="text-white">"{selectedJob.title}"</strong>?
                    </p>
                    <p className="text-[11px] text-slate-500">The recruiter will be notified. This job will NOT be published to workers.</p>
                    <div className="flex gap-3 justify-center pt-2">
                      <button
                        onClick={() => setConfirmAction(null)}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmReject}
                        disabled={submitting}
                        className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        {submitting ? 'Rejecting...' : <><XCircle className="w-4 h-4" /> Yes, Reject</>}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                      <Trash2 className="w-7 h-7 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Permanently Delete?</h3>
                    <p className="text-slate-400 text-sm">
                      Permanently delete <strong className="text-white">"{selectedJob.title}"</strong>?
                    </p>
                    <p className="text-[11px] text-rose-400/80 font-bold">This action cannot be undone. The Job Request and its associated soft-deleted queue record will be permanently removed.</p>
                    <div className="flex gap-3 justify-center pt-2">
                      <button
                        onClick={() => setConfirmAction(null)}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmPermanentDelete}
                        disabled={submitting}
                        className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        {submitting ? 'Deleting...' : <><Trash2 className="w-4 h-4" /> Permanently Delete</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-5 text-xs relative">
            {/* Job Meta */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={selectedJob.status} />
              <span className="text-slate-500 text-[10px]">ID: {selectedJob._id}</span>
              <span className="text-slate-500 text-[10px]">Submitted: {formatDate(selectedJob.createdAt)}</span>
              {selectedJob.reviewedAt && (
                <span className="text-slate-500 text-[10px]">Reviewed: {formatDate(selectedJob.reviewedAt)}</span>
              )}
            </div>

            {/* Recruiter Details */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-400" /> Recruiter Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Name</span>
                  <span className="font-semibold text-white">{getRecruiterName(selectedJob)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Email</span>
                  <span>{getRecruiterEmail(selectedJob)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone</span>
                  <span>{getRecruiterPhone(selectedJob)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Company</span>
                  <span>{getCompanyName(selectedJob) || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" /> Job Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Title</span>
                  <span className="font-semibold text-white">{selectedJob.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Event Type</span>
                  <span className="text-brand-300 font-bold">{selectedJob.eventType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Event Date</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(selectedJob.eventDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Time</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedJob.startTime} – {selectedJob.endTime}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Location</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {getLocationString(selectedJob.location)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Workers Required</span>
                  <span className="flex items-center gap-1 font-bold text-purple-300"><Users className="w-3 h-3" /> {selectedJob.workersRequired} Staff</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Description</span>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedJob.description || 'N/A'}</p>
              </div>

              {selectedJob.requiredSkills?.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Required Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.requiredSkills.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 text-[10px] font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.workerRequirements && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Worker Requirements</span>
                  <p className="text-slate-300">{selectedJob.workerRequirements}</p>
                </div>
              )}

              {selectedJob.responsibilities && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Responsibilities</span>
                  <p className="text-slate-300">{selectedJob.responsibilities}</p>
                </div>
              )}

              {selectedJob.additionalInstructions && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Additional Instructions</span>
                  <p className="text-slate-300">{selectedJob.additionalInstructions}</p>
                </div>
              )}
            </div>

            {/* ── Payment Offer (Immutable Snapshot) ── */}
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-3">
              <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-400" /> Recruiter's Payment Offer
                <span className="ml-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                  Captured at Submission
                </span>
              </h4>
              <p className="text-[10px] text-amber-200/60">
                This is the immutable offer recorded when the recruiter submitted the request. It does not change even if the recruiter later modifies their job or payment information.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-500/70 block text-[10px] uppercase font-bold mb-1">Per Person</span>
                  <span className="font-extrabold text-amber-300 text-lg">
                    {formatCurrency(selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span className="text-purple-400/70 block text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Workers
                  </span>
                  <span className="font-extrabold text-purple-300 text-lg">{selectedJob.workersRequired}</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400/70 block text-[10px] uppercase font-bold mb-1">Total Offer</span>
                  <span className="font-extrabold text-emerald-300 text-lg">
                    {formatCurrency(
                      selectedJob.offeredTotalAmount ??
                      ((selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment) * selectedJob.workersRequired)
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-amber-200/50">
                <Clock className="w-3 h-3" />
                <span>
                  Offer captured on:{' '}
                  <span className="text-amber-300/80 font-semibold">
                    {selectedJob.offeredAmountCapturedAt
                      ? formatDateTime(selectedJob.offeredAmountCapturedAt)
                      : formatDateTime(selectedJob.createdAt)}
                  </span>
                </span>
              </div>

              {/* Formula proof */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-amber-400 font-bold">
                  {formatCurrency(selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment)}
                </span>
                <span>× {selectedJob.workersRequired} workers =</span>
                <span className="text-emerald-400 font-bold">
                  {formatCurrency(
                    selectedJob.offeredTotalAmount ??
                    ((selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment) * selectedJob.workersRequired)
                  )}
                  {' '}total
                </span>
              </div>
            </div>

            {/* ── Admin Decision / Payment ── */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-400" /> Admin Decision
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Recruiter Proposed (per person)</span>
                  <span className="font-extrabold text-amber-400 text-base">{formatCurrency(selectedJob.recruiterProposedPayment)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Admin Approved Payment</span>
                  <span className="font-extrabold text-emerald-400 text-base">
                    {selectedJob.adminApprovedPayment ? formatCurrency(selectedJob.adminApprovedPayment) : '—'}
                  </span>
                </div>
              </div>

              {/* Acceptance Proof */}
              {selectedJob.status === 'APPROVED' && selectedJob.acceptedAt && (
                <div className="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Acceptance Proof</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Accepted At</span>
                      <span className="text-emerald-300 font-semibold">{formatDateTime(selectedJob.acceptedAt)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Original Offer</span>
                      <span className="text-amber-300 font-semibold">
                        {formatCurrency(selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment)}/person × {selectedJob.workersRequired} = {formatCurrency(
                          selectedJob.offeredTotalAmount ??
                          ((selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment) * selectedJob.workersRequired)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedJob.adminNotes && modalMode === 'view' && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1">Admin Notes / Reason</span>
                  <p className="text-slate-300">{selectedJob.adminNotes}</p>
                </div>
              )}
              {selectedJob.reviewedAt && (
                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Reviewed: {formatDateTime(selectedJob.reviewedAt)}
                </div>
              )}
            </div>

            {/* ===== APPROVE MODE ===== */}
            {modalMode === 'approve' && selectedJob.status === 'PENDING_REVIEW' && (
              <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <h4 className="font-bold text-emerald-300 text-sm">Set Final Admin-Approved Payment</h4>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Recruiter offered{' '}
                    <strong>{formatCurrency(selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment)}/person</strong>
                    {' '}× {selectedJob.workersRequired} workers ={' '}
                    <strong className="text-emerald-300">
                      {formatCurrency(
                        selectedJob.offeredTotalAmount ??
                        ((selectedJob.offeredAmountPerPerson ?? selectedJob.recruiterProposedPayment) * selectedJob.workersRequired)
                      )} total offer
                    </strong>.
                    {' '}You can adjust the Admin-approved payment below. Workers will ONLY see the Admin-approved amount.
                  </span>
                </div>
                <div>
                  <label className="block font-bold text-emerald-400 mb-1">Final Admin-Approved Payment (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={approvePayment}
                    onChange={(e) => setApprovePayment(Number(e.target.value))}
                    className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-xl px-3 py-2.5 text-emerald-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Admin Internal Notes (optional)</label>
                  <textarea
                    rows="2"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    placeholder="Internal notes (not visible to workers)..."
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="gradient-btn px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" /> Approve with {formatCurrency(approvePayment)}
                  </button>
                </div>
              </div>
            )}

            {/* ===== REJECT MODE ===== */}
            {modalMode === 'reject' && selectedJob.status === 'PENDING_REVIEW' && (
              <div className="p-4 rounded-xl border-2 border-rose-500/30 bg-rose-500/5 space-y-3">
                <h4 className="font-bold text-rose-300 text-sm">Rejection Reason</h4>
                <p className="text-slate-400 text-[11px]">Provide a reason for rejecting this job request. The recruiter will be notified.</p>
                <textarea
                  rows="3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-rose-500/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  placeholder="Enter rejection reason..."
                  required
                />
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleReject}
                    disabled={submitting || !rejectionReason.trim()}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Reject Job
                  </button>
                </div>
              </div>
            )}

            {/* View mode actions for pending jobs */}
            {modalMode === 'view' && selectedJob.status === 'PENDING_REVIEW' && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setModalMode('reject')}
                  className="px-4 py-2 rounded-xl text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => setModalMode('approve')}
                  className="gradient-btn px-6 py-2 rounded-xl font-bold flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" /> Review & Approve
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ===== EDIT/UPDATE MODE FOR REJECTED JOBS ===== */}
      {selectedJob && modalMode === 'edit' && (
        <JobApprovalModal
          isOpen={true}
          onClose={() => { setSelectedJob(null); setModalMode('view'); }}
          job={selectedJob}
          onSubmitReview={handleFullReview}
        />
      )}

      {/* ===== BULK CONFIRM MODAL ===== */}
      {bulkConfirm && (
        <BulkConfirmModal
          open={true}
          onClose={() => setBulkConfirm(null)}
          onConfirm={executeBulkAction}
          count={bulk.selectedCount}
          actionLabel={bulkConfirm.label}
          description={bulkConfirm.desc}
          loading={bulkLoading}
          isDanger={bulkConfirm.isDanger !== false}
        />
      )}
    </div>
  );
};

export default AdminJobRequests;
