import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import jobService from '../../services/jobService';
import assignmentService from '../../services/assignmentService';
import paymentService from '../../services/paymentService';
import EventLifecycleView from '../../components/admin/EventLifecycleView';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import {
  Layers,
  Award,
  CheckCircle2,
  Trash2,
  RefreshCcw,
  AlertTriangle,
  ArrowRight,
  FileText,
  Printer,
  Users,
  Eye,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import JobApprovalModal from '../../components/admin/JobApprovalModal';
import { getLocationString } from '../../utils/locationHelper';
import attendanceService from '../../services/attendanceService';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar, BulkConfirmModal } from '../../components/admin/BulkActionComponents';
import bulkAdminService from '../../services/bulkAdminService';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

const ACTIVE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Active Statuses' },
  { value: 'APPROVED', label: 'Approved & Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** Case-insensitive partial-match search across event/job fields */
const matchesEventSearch = (job, query) => {
  if (!query) return true;
  const title = (job.title || '').toLowerCase();
  const location = getLocationString(job.location).toLowerCase();
  const eventType = (job.eventType || '').toLowerCase();
  const recruiterName = (job.recruiterProfile?.fullName || '').toLowerCase();
  const recruiterEmail = (job.recruiterProfile?.email || job.recruiterId?.email || '').toLowerCase();
  const recruiterCompany = (job.recruiterProfile?.companyName || '').toLowerCase();
  return (
    title.includes(query) ||
    location.includes(query) ||
    eventType.includes(query) ||
    recruiterName.includes(query) ||
    recruiterEmail.includes(query) ||
    recruiterCompany.includes(query)
  );
};

export const AdminEvents = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  const [jobs, setJobs] = useState([]);
  const [trashJobs, setTrashJobs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();

  // Tabs: 'ACTIVE' | 'COMPLETED' | 'TRASH'
  // Honour ?tab=COMPLETED or ?tab=TRASH in the URL (e.g. from Dashboard link)
  const initialTab = ['ACTIVE', 'COMPLETED', 'TRASH'].includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'ACTIVE';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [selectedJobId, setSelectedJobId] = useState(null); // Details Modal
  const [updateJob, setUpdateJob] = useState(null); // Update Modal

  // Mark as Completed Modal State
  const [completeConfirmJob, setCompleteConfirmJob] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completingLoading, setCompletingLoading] = useState(false);

  // Reopen Event Modal State
  const [reopenConfirmJob, setReopenConfirmJob] = useState(null);
  const [reopenNotes, setReopenNotes] = useState('');
  const [reopeningLoading, setReopeningLoading] = useState(false);

  // Confirmation Modals State
  const [deleteConfirmJob, setDeleteConfirmJob] = useState(null);
  const [restoreConfirmJob, setRestoreConfirmJob] = useState(null);
  const [permanentDeleteConfirmJob, setPermanentDeleteConfirmJob] = useState(null);

  // Search & filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [completedSearchText, setCompletedSearchText] = useState('');
  const [trashSearchText, setTrashSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [jRes, tRes, aRes, pRes, attRes] = await Promise.all([
      jobService.getAllJobs(),
      jobService.getTrashJobs(),
      assignmentService.getAllAssignments(),
      paymentService.getAllPayments(),
      attendanceService.getAllAttendance(),
    ]);
    if (jRes?.success) setJobs(jRes.data);
    if (tRes?.success) setTrashJobs(tRes.data);
    if (aRes?.success) setAssignments(aRes.data);
    if (pRes?.success) setPayments(pRes.data);
    if (attRes?.success) setAttendances(attRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Events that are not completed (Active view)
  const isActiveEvent = (j) =>
    j.status !== 'COMPLETED' &&
    (j.status === 'APPROVED' ||
      j.status === 'SUSPENDED' ||
      (j.status === 'REJECTED' && j.acceptedAt) ||
      j.status === 'IN_PROGRESS' ||
      j.status === 'PENDING_REVIEW');

  // Events that are completed (Completed view)
  const isCompletedEvent = (j) => j.status === 'COMPLETED';

  // Derived: active jobs with search + status filter + date filter
  const filteredActiveJobs = useMemo(() => {
    let result = jobs.filter(isActiveEvent);

    if (statusFilter !== 'ALL') {
      result = result.filter((j) => j.status === statusFilter);
    }

    if (dateFilter.preset !== 'all') {
      result = result.filter((j) => matchesDateFilter(j.eventDate || j.createdAt, dateFilter));
    }

    const query = searchText.trim().toLowerCase();
    if (query) {
      result = result.filter((job) => matchesEventSearch(job, query));
    }

    return result;
  }, [jobs, searchText, statusFilter, dateFilter]);

  const totalActiveJobs = useMemo(() => jobs.filter(isActiveEvent).length, [jobs]);

  // Derived: completed jobs with search + date filter (completion date or event date)
  const filteredCompletedJobs = useMemo(() => {
    let result = jobs.filter(isCompletedEvent);

    if (dateFilter.preset !== 'all') {
      result = result.filter((j) => matchesDateFilter(j.completedAt || j.updatedAt || j.eventDate, dateFilter));
    }

    const query = completedSearchText.trim().toLowerCase();
    if (query) {
      result = result.filter((job) => matchesEventSearch(job, query));
    }

    return result;
  }, [jobs, completedSearchText, dateFilter]);

  const totalCompletedJobs = useMemo(() => jobs.filter(isCompletedEvent).length, [jobs]);

  // Derived: filtered trash jobs
  const filteredTrashJobs = useMemo(() => {
    let result = trashJobs;
    if (dateFilter.preset !== 'all') {
      result = result.filter((j) => matchesDateFilter(j.eventDate || j.createdAt, dateFilter));
    }
    const query = trashSearchText.trim().toLowerCase();
    if (!query) return result;
    return result.filter((job) => matchesEventSearch(job, query));
  }, [trashJobs, trashSearchText, dateFilter]);

  // Bulk Selection hooks
  const bulkActive = useBulkSelection(filteredActiveJobs);
  const bulkCompleted = useBulkSelection(filteredCompletedJobs);
  const bulkTrash = useBulkSelection(filteredTrashJobs);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk actions executor
  const executeBulkAction = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    let ids = [];
    if (bulkConfirm.target === 'trash') {
      ids = bulkTrash.selectedIdsArray;
    } else if (bulkConfirm.target === 'completed') {
      ids = bulkCompleted.selectedIdsArray;
    } else {
      ids = bulkActive.selectedIdsArray;
    }

    let res;
    if (bulkConfirm.action === 'delete') {
      res = await bulkAdminService.bulkDeleteJobs(ids);
    } else if (bulkConfirm.action === 'restore') {
      res = await bulkAdminService.bulkRestoreJobs(ids);
    } else if (bulkConfirm.action === 'permanent') {
      res = await bulkAdminService.bulkPermanentDeleteJobs(ids);
    }
    setBulkLoading(false);
    setBulkConfirm(null);
    if (res?.success) {
      showToast(res.message, 'success');
      if (bulkConfirm.target === 'trash') bulkTrash.clearSelection();
      else if (bulkConfirm.target === 'completed') bulkCompleted.clearSelection();
      else bulkActive.clearSelection();
      fetchData();
    } else {
      showToast(res?.message || 'Bulk operation failed', 'error');
    }
  };

  // Print / Save PDF export — complete event details
  const handleExportPdf = (target = 'active') => {
    let list = filteredActiveJobs;
    let bulkObj = bulkActive;
    let title = 'Events & Completion (Active Events)';
    let cleanSectionName = 'Events_Active';

    if (target === 'trash') {
      list = filteredTrashJobs;
      bulkObj = bulkTrash;
      title = 'Events & Completion (Trash)';
      cleanSectionName = 'Events_Trash';
    } else if (target === 'completed') {
      list = filteredCompletedJobs;
      bulkObj = bulkCompleted;
      title = 'Events & Completion (Completed Events)';
      cleanSectionName = 'Events_Completed';
    }

    const selected = list.filter((j) => bulkObj.isSelected(j._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportDetailedRecordsToPdf({
      title,
      subtitle: `Exported on ${dateStr} — ${selected.length} record(s)`,
      filename: `JobbyHop_${cleanSectionName}_${dateStr}.pdf`,
      records: selected,
      buildCard: (j) => {
        const jId = String(j._id || j.id || '');
        const jobAssignments = assignments.filter((a) => String(a.jobId?._id || a.jobId || '') === jId);
        const jobPayments = payments.filter((p) => String(p.jobId?._id || p.jobId || '') === jId);
        const jobAttendances = attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === jId);

        let venueStr = null;
        let addressStr = null;
        if (typeof j.location === 'object' && j.location !== null) {
          venueStr = j.location.venue || null;
          addressStr = j.location.address || null;
        } else if (typeof j.location === 'string') {
          addressStr = j.location;
        }
        const timeStr = j.startTime && j.endTime ? `${j.startTime} – ${j.endTime}` : j.startTime || j.endTime || null;
        const primaryPayment = jobPayments[0];
        const paidPayment = jobPayments.find((p) => p.paidAt);
        const refPayment = jobPayments.find((p) => p.transactionRef);

        const attWithCheckIn = jobAttendances.find((a) => a.checkInTime);
        const attWithCheckOut = jobAttendances.find((a) => a.checkOutTime);
        const attWithHours = jobAttendances.find((a) => a.hours || a.totalHours);

        return [
          {
            heading: 'EVENT INFORMATION',
            color: '#8b5cf6',
            rows: [
              ['Event Title', j.title],
              ['Event Type', j.eventType],
              ['Date', formatDate(j.eventDate)],
              ['Start/End Time', timeStr],
              ['Location', getLocationString(j.location)],
              ['Venue', venueStr],
              ['Address', addressStr],
              ['Description', j.description],
              ['Workers Required', j.workersRequired],
              ['Workers Assigned', j.assignedWorkersCount ?? jobAssignments.length],
            ],
          },
          {
            heading: 'RECRUITER INFORMATION',
            color: '#06b6d4',
            rows: [
              ['Recruiter', j.recruiterProfile?.fullName || j.recruiterId?.fullName || j.recruiterId?.email],
              ['Company', j.recruiterProfile?.companyName],
              ['Email', j.recruiterProfile?.email || j.recruiterId?.email],
              ['Phone', j.recruiterProfile?.phone || j.recruiterId?.phone],
            ],
          },
          {
            heading: 'WORKER INFORMATION',
            color: '#f59e0b',
            rows: [
              ['Assigned Workers', jobAssignments.length > 0 ? `${jobAssignments.length} Worker(s) Assigned` : 'No workers assigned yet'],
              ...(jobAssignments.length > 0
                ? jobAssignments.flatMap((a, i) => [
                    [`Worker ${i + 1}`, a.workerProfile?.fullName || a.workerId?.name || a.workerId?.email],
                    [`Worker ${i + 1} Email`, a.workerProfile?.email || a.workerId?.email],
                    [`Worker ${i + 1} Phone`, a.workerProfile?.phone || a.workerId?.phone],
                    [`Worker ${i + 1} Assignment Status`, a.status],
                  ])
                : []),
            ],
          },
          {
            heading: 'PAYMENT INFORMATION',
            color: '#10b981',
            rows: [
              ['Requested Amount (per person)', formatCurrency(j.recruiterProposedPayment ?? j.recruiterRequestedRate)],
              ['Approved Amount (per person)', formatCurrency(j.adminApprovedPayment || j.finalWorkerPayout)],
              ['Worker Payout', formatCurrency(j.adminApprovedPayment || j.finalWorkerPayout || j.recruiterProposedPayment)],
              ['Total Offer Amount', formatCurrency(j.offeredTotalAmount)],
              ['Payment Status', j.recruiterPaymentStatus || 'PENDING'],
              ['Payment Date', paidPayment?.paidAt ? formatDate(paidPayment.paidAt) : null],
              ['UTR / Reference', refPayment?.transactionRef],
              ['Payment Method', primaryPayment?.paymentMethod || 'Bank Transfer / UPI'],
              ['Admin Payment Notes', j.adminNotes],
            ],
          },
          {
            heading: 'ATTENDANCE / COMPLETION',
            color: '#3b82f6',
            rows: [
              [
                'Attendance Status',
                jobAttendances.length > 0
                  ? jobAttendances.every((a) => a.status === 'PRESENT')
                    ? 'ALL PRESENT'
                    : jobAttendances.some((a) => a.status === 'VERIFIED')
                    ? 'VERIFIED'
                    : 'PENDING'
                  : 'PENDING',
              ],
              ['Check-in', attWithCheckIn?.checkInTime],
              ['Check-out', attWithCheckOut?.checkOutTime],
              ['Hours', attWithHours?.hours || attWithHours?.totalHours],
              ['Completion Status', j.status === 'COMPLETED' ? 'COMPLETED' : 'In Progress'],
              ['Completion Date', j.completedAt ? formatDateTime(j.completedAt) : null],
            ],
          },
          {
            heading: 'STATUS / ADMIN INFORMATION',
            color: '#64748b',
            rows: [
              ['Status', j.status],
              ['Approval Information', j.acceptedAt ? `Approved on ${formatDate(j.acceptedAt)}` : 'Pending Admin Review'],
              ['Submitted Date', formatDate(j.createdAt)],
              ['Approved Date', formatDate(j.acceptedAt)],
              ['Completed Date', j.completedAt ? formatDateTime(j.completedAt) : 'Not Completed'],
              ['Last Updated', formatDate(j.updatedAt)],
              ['Record ID', j._id],
              ...(target === 'trash'
                ? [
                    ['Deleted At', formatDate(j.deletedAt)],
                    ['Auto-Delete At', formatDate(j.permanentDeleteAt)],
                  ]
                : []),
            ],
          },
        ];
      },
    });
  };

  // Open Details Modal
  const handleOpenDetails = async (id) => {
    await fetchData();
    setSelectedJobId(id);
  };

  // Update Event Handler
  const handleUpdateEvent = async (jobId, formData) => {
    try {
      const res = await jobService.reviewJobByAdmin(jobId, formData, adminUser);
      if (res && res.success) {
        showToast('Event updated successfully!', 'success');
        setUpdateJob(null);
        await fetchData();
        return { success: true };
      } else {
        showToast(res?.message || 'Error updating event status', 'error');
        return { success: false, message: res?.message || 'Error updating event status' };
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error updating event status';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  // Execute Complete Event Action (confirmed)
  const handleExecuteComplete = async () => {
    if (!completeConfirmJob) return;
    setCompletingLoading(true);
    try {
      const res = await jobService.completeEventByAdmin(completeConfirmJob._id, completeNotes, adminUser);
      if (res && res.success) {
        showToast(res.message || `Event '${completeConfirmJob.title}' marked as COMPLETED!`, 'success');
        setCompleteConfirmJob(null);
        setCompleteNotes('');
        setSelectedJobId(null);
        await fetchData();
      } else {
        showToast(res?.message || 'Error completing event', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'Error completing event', 'error');
    } finally {
      setCompletingLoading(false);
    }
  };

  // Execute Reopen Event Action (confirmed)
  const handleExecuteReopen = async () => {
    if (!reopenConfirmJob) return;
    setReopeningLoading(true);
    try {
      const res = await jobService.reopenEventByAdmin(reopenConfirmJob._id, reopenNotes, adminUser);
      if (res && res.success) {
        showToast(res.message || `Event '${reopenConfirmJob.title}' reopened and returned to Active Events.`, 'success');
        setReopenConfirmJob(null);
        setReopenNotes('');
        setSelectedJobId(null);
        await fetchData();
      } else {
        showToast(res?.message || 'Error reopening event', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'Error reopening event', 'error');
    } finally {
      setReopeningLoading(false);
    }
  };

  // Soft Delete Handler
  const handleSoftDelete = async () => {
    if (!deleteConfirmJob) return;
    try {
      const res = await jobService.softDeleteJob(deleteConfirmJob._id);
      if (res && res.success) {
        showToast('Event moved to Trash successfully.', 'success');
        setDeleteConfirmJob(null);
        fetchData();
      } else {
        showToast(res?.message || 'Error moving to trash', 'error');
      }
    } catch (err) {
      showToast('Error moving event to trash', 'error');
    }
  };

  // Restore Handler
  const handleRestore = async () => {
    if (!restoreConfirmJob) return;
    try {
      const res = await jobService.restoreJob(restoreConfirmJob._id);
      if (res && res.success) {
        showToast('Event restored successfully.', 'success');
        setRestoreConfirmJob(null);
        fetchData();
      } else {
        showToast(res?.message || 'Error restoring event', 'error');
      }
    } catch (err) {
      showToast('Error restoring event', 'error');
    }
  };

  // Permanent Delete Handler
  const handlePermanentDelete = async () => {
    if (!permanentDeleteConfirmJob) return;
    try {
      const res = await jobService.permanentDeleteJob(permanentDeleteConfirmJob._id);
      if (res && res.success) {
        showToast('Event permanently deleted.', 'success');
        setPermanentDeleteConfirmJob(null);
        fetchData();
      } else {
        showToast(res?.message || 'Error deleting event permanently', 'error');
      }
    } catch (err) {
      showToast('Error permanently deleting event', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-xs">
      {/* Header and Tabs */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Layers className="w-6 h-6 text-brand-500" /> Events & Completion
          </h1>
          <p className="text-slate-400 mt-1">Manage event status, completion lifecycle, and trash archive.</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shrink-0">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'ACTIVE' ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('ACTIVE')}
          >
            Active Events ({totalActiveJobs})
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'COMPLETED' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('COMPLETED')}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed Events ({totalCompletedJobs})
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'TRASH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('TRASH')}
          >
            <Trash2 className="w-3.5 h-3.5" /> Trash ({trashJobs.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: ACTIVE EVENTS ── */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-4">
          <SearchFilterBar
            searchValue={searchText}
            onSearchChange={setSearchText}
            placeholder="Search active event, recruiter, location..."
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={ACTIVE_STATUS_OPTIONS}
            totalCount={totalActiveJobs}
            filteredCount={filteredActiveJobs.length}
            countLabel="events"
          >
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </SearchFilterBar>

          <BulkActionToolbar
            selectedCount={bulkActive.selectedCount}
            onClear={bulkActive.clearSelection}
            visible={bulkActive.selectedCount > 0}
            actions={[
              {
                label: 'Print / Save PDF',
                icon: Printer,
                onClick: () => handleExportPdf('active'),
              },
              {
                label: 'Move to Trash',
                icon: Trash2,
                onClick: () =>
                  setBulkConfirm({
                    target: 'active',
                    action: 'delete',
                    label: 'Move to Trash',
                    desc: `Move ${bulkActive.selectedCount} event(s) to trash?`,
                    isDanger: false,
                  }),
                variant: 'danger',
              },
            ]}
          />

          {totalActiveJobs > 0 && filteredActiveJobs.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <BulkCheckbox
                id="events-active-select-all"
                checked={bulkActive.isAllSelected}
                indeterminate={bulkActive.isIndeterminate}
                onChange={() => (bulkActive.isAllSelected ? bulkActive.clearSelection() : bulkActive.selectAll())}
                label={bulkActive.isAllSelected ? 'Deselect All' : 'Select All'}
              />
              {bulkActive.selectedCount > 0 && (
                <span className="text-xs font-bold text-brand-400">
                  {bulkActive.selectedCount} / {filteredActiveJobs.length} selected
                </span>
              )}
            </div>
          )}

          {totalActiveJobs === 0 ? (
            <EmptyState title="No active events found." description="All approved events are either completed or in trash." />
          ) : filteredActiveJobs.length === 0 ? (
            <EmptyState title="No events match your search or filters." description="Try adjusting your search term or status filter." />
          ) : (
            filteredActiveJobs.map((job) => (
              <div
                key={job._id}
                className={`glass-card flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors gap-4 ${
                  bulkActive.isSelected(job._id) ? 'bg-brand-500/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <BulkCheckbox
                    id={`event-cb-${job._id}`}
                    checked={bulkActive.isSelected(job._id)}
                    onChange={() => bulkActive.toggleSelection(job._id)}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-brand-400 uppercase">{job.eventType}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-1" title={job.title}>
                      {job.title}
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      📍 {getLocationString(job.location)} • {formatDate(job.eventDate)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Recruiter</span>
                    <span className="text-white font-medium">
                      {job.recruiterProfile?.fullName || job.recruiterId?.email || 'Recruiter'}
                      {job.recruiterProfile?.companyName ? ` (${job.recruiterProfile.companyName})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Workers</span>
                    <span className="text-purple-400 font-bold">
                      {job.assignedWorkersCount || 0} / {job.workersRequired} Staff
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Verified Attendance</span>
                    <span className="text-emerald-400 font-bold">
                      {attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === String(job._id) && a.status === 'PRESENT' && a.verifiedByAdminId && !a.isDeleted).length} Present
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Payable Total</span>
                    <span className="font-extrabold text-emerald-400">
                      {formatCurrency(
                        attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === String(job._id) && a.status === 'PRESENT' && a.verifiedByAdminId && !a.isDeleted).length *
                        Number(job.adminApprovedPayment || job.offeredAmountPerPerson || job.recruiterProposedPayment || 0)
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 shrink-0">
                  {job.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompleteConfirmJob(job);
                        setCompleteNotes('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/30 rounded-lg font-bold transition-all shadow-sm"
                      title="Mark Event as Completed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(job._id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 hover:text-brand-300 rounded-lg font-semibold transition-colors"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateJob(job)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg font-semibold transition-colors"
                    title="Update Event"
                  >
                    <FileText className="w-3 h-3" /> Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmJob(job)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Move to Trash"
                    aria-label="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 2: COMPLETED EVENTS ── */}
      {activeTab === 'COMPLETED' && (
        <div className="space-y-4">
          <SearchFilterBar
            searchValue={completedSearchText}
            onSearchChange={setCompletedSearchText}
            placeholder="Search completed event, recruiter, location..."
            filterOptions={[]}
            totalCount={totalCompletedJobs}
            filteredCount={filteredCompletedJobs.length}
            countLabel="completed events"
          >
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </SearchFilterBar>

          <BulkActionToolbar
            selectedCount={bulkCompleted.selectedCount}
            onClear={bulkCompleted.clearSelection}
            visible={bulkCompleted.selectedCount > 0}
            actions={[
              {
                label: 'Print / Save PDF',
                icon: Printer,
                onClick: () => handleExportPdf('completed'),
              },
              {
                label: 'Move to Trash',
                icon: Trash2,
                onClick: () =>
                  setBulkConfirm({
                    target: 'completed',
                    action: 'delete',
                    label: 'Move to Trash',
                    desc: `Move ${bulkCompleted.selectedCount} completed event(s) to trash?`,
                    isDanger: false,
                  }),
                variant: 'danger',
              },
            ]}
          />

          {totalCompletedJobs > 0 && filteredCompletedJobs.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <BulkCheckbox
                id="events-completed-select-all"
                checked={bulkCompleted.isAllSelected}
                indeterminate={bulkCompleted.isIndeterminate}
                onChange={() => (bulkCompleted.isAllSelected ? bulkCompleted.clearSelection() : bulkCompleted.selectAll())}
                label={bulkCompleted.isAllSelected ? 'Deselect All' : 'Select All'}
              />
              {bulkCompleted.selectedCount > 0 && (
                <span className="text-xs font-bold text-brand-400">
                  {bulkCompleted.selectedCount} / {filteredCompletedJobs.length} selected
                </span>
              )}
            </div>
          )}

          {totalCompletedJobs === 0 ? (
            <EmptyState
              title="No completed events yet."
              description="Events marked as completed from Active Events will appear here with full completion logs and payout status."
            />
          ) : filteredCompletedJobs.length === 0 ? (
            <EmptyState title="No completed events match your search." description="Try adjusting your search query." />
          ) : (
            filteredCompletedJobs.map((job) => (
              <div
                key={job._id}
                className={`glass-card flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-blue-900/30 bg-blue-950/10 hover:border-blue-700/50 transition-colors gap-4 ${
                  bulkCompleted.isSelected(job._id) ? 'bg-brand-500/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <BulkCheckbox
                    id={`event-completed-cb-${job._id}`}
                    checked={bulkCompleted.isSelected(job._id)}
                    onChange={() => bulkCompleted.toggleSelection(job._id)}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">{job.eventType}</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        <CheckCircle2 className="w-3 h-3 text-blue-400" /> Event Completed
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-1" title={job.title}>
                      {job.title}
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      📍 {getLocationString(job.location)} • Event Date: {formatDate(job.eventDate)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Recruiter</span>
                    <span className="text-white font-medium">
                      {job.recruiterProfile?.fullName || job.recruiterId?.email || 'Recruiter'}
                      {job.recruiterProfile?.companyName ? ` (${job.recruiterProfile.companyName})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Staff Required</span>
                    <span className="text-purple-300 font-bold">
                      {job.workersRequired} Staff ({job.assignedWorkersCount || 0} Assigned)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Verified Attendance</span>
                    <span className="text-emerald-400 font-bold">
                      {attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === String(job._id) && a.status === 'PRESENT' && a.verifiedByAdminId && !a.isDeleted).length} Present
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Payable Total</span>
                    <span className="font-extrabold text-emerald-400">
                      {formatCurrency(
                        attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === String(job._id) && a.status === 'PRESENT' && a.verifiedByAdminId && !a.isDeleted).length *
                        Number(job.adminApprovedPayment || job.offeredAmountPerPerson || job.recruiterProposedPayment || 0)
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Completed On</span>
                    <span className="text-blue-300 font-medium">
                      {formatDate(job.completedAt || job.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setReopenConfirmJob(job);
                      setReopenNotes('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border border-amber-500/30 rounded-lg font-bold transition-all shadow-sm"
                    title="Mark Not Completed / Reopen Event"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Reopen Event
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(job._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 rounded-lg font-bold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateJob(job)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg font-semibold transition-colors"
                    title="Edit Notes"
                  >
                    <FileText className="w-3 h-3" /> Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmJob(job)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Move to Trash"
                    aria-label="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 3: TRASH ── */}
      {activeTab === 'TRASH' && (
        <div className="space-y-4">
          <SearchFilterBar
            searchValue={trashSearchText}
            onSearchChange={setTrashSearchText}
            placeholder="Search trash events..."
            filterOptions={[]}
            totalCount={trashJobs.length}
            filteredCount={filteredTrashJobs.length}
            countLabel="events in trash"
          >
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </SearchFilterBar>

          <BulkActionToolbar
            selectedCount={bulkTrash.selectedCount}
            onClear={bulkTrash.clearSelection}
            visible={bulkTrash.selectedCount > 0}
            actions={[
              {
                label: 'Print / Save PDF',
                icon: Printer,
                onClick: () => handleExportPdf('trash'),
              },
              {
                label: 'Restore Selected',
                icon: RefreshCcw,
                onClick: () =>
                  setBulkConfirm({
                    target: 'trash',
                    action: 'restore',
                    label: 'Restore',
                    desc: `Restore ${bulkTrash.selectedCount} event(s) from trash?`,
                    isDanger: false,
                  }),
              },
              {
                label: 'Permanently Delete Selected',
                icon: Trash2,
                onClick: () =>
                  setBulkConfirm({
                    target: 'trash',
                    action: 'permanent',
                    label: 'Permanently Delete',
                    desc: `Permanently delete ${bulkTrash.selectedCount} event(s)? This cannot be undone.`,
                    isDanger: true,
                  }),
                variant: 'danger',
              },
            ]}
          />

          {trashJobs.length > 0 && filteredTrashJobs.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <BulkCheckbox
                id="events-trash-select-all"
                checked={bulkTrash.isAllSelected}
                indeterminate={bulkTrash.isIndeterminate}
                onChange={() => (bulkTrash.isAllSelected ? bulkTrash.clearSelection() : bulkTrash.selectAll())}
                label={bulkTrash.isAllSelected ? 'Deselect All' : 'Select All'}
              />
              {bulkTrash.selectedCount > 0 && (
                <span className="text-xs font-bold text-brand-400">
                  {bulkTrash.selectedCount} / {filteredTrashJobs.length} selected
                </span>
              )}
            </div>
          )}

          {trashJobs.length === 0 ? (
            <EmptyState title="Trash is empty." />
          ) : filteredTrashJobs.length === 0 ? (
            <EmptyState title="No trash events match your search." description="Try adjusting your search term." />
          ) : (
            filteredTrashJobs.map((job) => (
              <div
                key={job._id}
                className={`glass-card flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-red-950/40 bg-red-950/5 hover:border-slate-700 transition-colors gap-4 ${
                  bulkTrash.isSelected(job._id) ? 'bg-red-500/10' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <BulkCheckbox
                    id={`trash-event-cb-${job._id}`}
                    checked={bulkTrash.isSelected(job._id)}
                    onChange={() => bulkTrash.toggleSelection(job._id)}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{job.title}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">📍 {getLocationString(job.location)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div>Deleted: {formatDate(job.deletedAt)}</div>
                  <div className="text-red-400/80 font-semibold">Auto-delete: {formatDate(job.permanentDeleteAt)}</div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRestoreConfirmJob(job)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-semibold transition-colors"
                  >
                    <RefreshCcw className="w-3 h-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteConfirmJob(job)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg font-semibold transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" /> Delete Permanently
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MARK AS COMPLETED CONFIRMATION MODAL ── */}
      <Modal
        isOpen={!!completeConfirmJob}
        onClose={() => !completingLoading && setCompleteConfirmJob(null)}
        title="Complete Event Confirmation"
        maxWidth="max-w-lg"
      >
        {completeConfirmJob && (
          <div className="space-y-5 text-xs">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Record Event as Completed</h4>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  This action marks the event as <strong>COMPLETED</strong> in the system and triggers worker payout moderation (target 10–15 day timeline).
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Event Title:</span>
                <span className="font-bold text-white text-sm">{completeConfirmJob.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Event Date:</span>
                <span className="text-white">{formatDate(completeConfirmJob.eventDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Location:</span>
                <span className="text-white">{getLocationString(completeConfirmJob.location)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current Status:</span>
                <StatusBadge status={completeConfirmJob.status} />
              </div>
              {(() => {
                const jAtts = attendances.filter(
                  (a) => String(a.jobId?._id || a.jobId || '') === String(completeConfirmJob._id) &&
                         a.status === 'PRESENT' &&
                         a.verifiedByAdminId &&
                         !a.isDeleted
                );
                const rate = Number(completeConfirmJob.adminApprovedPayment || completeConfirmJob.offeredAmountPerPerson || completeConfirmJob.recruiterProposedPayment || 0);
                const totalAttendancePayable = jAtts.length * rate;
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Verified PRESENT Workers:</span>
                      <span className="font-bold text-white">
                        {jAtts.length} of {completeConfirmJob.workersRequired} requested
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Approved Rate (per worker):</span>
                      <span className="font-bold text-purple-300">
                        {formatCurrency(rate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="text-slate-300 font-bold uppercase text-[11px]">Total Calculated Payout:</span>
                      <span className="font-black text-emerald-400 text-sm">
                        {formatCurrency(totalAttendancePayable)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Completion Notes / Summary (Optional)
              </label>
              <textarea
                rows="3"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Add completion observations, headcount verification notes, etc..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={completingLoading}
                onClick={() => setCompleteConfirmJob(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completingLoading}
                onClick={handleExecuteComplete}
                className="gradient-btn px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {completingLoading ? 'Completing Event...' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── REOPEN EVENT CONFIRM MODAL ── */}
      <Modal
        isOpen={!!reopenConfirmJob}
        onClose={() => !reopeningLoading && setReopenConfirmJob(null)}
        title="Reopen Event / Mark Not Completed"
        maxWidth="max-w-lg"
      >
        {reopenConfirmJob && (
          <div className="space-y-5 text-xs">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <RefreshCcw className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Return Event to Active Workflow</h4>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  This action marks the event as <strong>ACTIVE (APPROVED)</strong> and returns it to the active events workflow.
                  Existing assignments, attendances, and payment audit records are safely preserved.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Event Title:</span>
                <span className="font-bold text-white text-sm">{reopenConfirmJob.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Event Date:</span>
                <span className="text-white">{formatDate(reopenConfirmJob.eventDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Location:</span>
                <span className="text-white">{getLocationString(reopenConfirmJob.location)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current Status:</span>
                <StatusBadge status={reopenConfirmJob.status} />
              </div>
              {reopenConfirmJob.completedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Completed On:</span>
                  <span className="text-blue-400 font-medium">{formatDateTime(reopenConfirmJob.completedAt)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Reason / Reopening Notes (Optional)
              </label>
              <textarea
                rows="3"
                value={reopenNotes}
                onChange={(e) => setReopenNotes(e.target.value)}
                placeholder="Reason for reopening (e.g., headcount dispute, rescheduling, additional attendance required)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={reopeningLoading}
                onClick={() => setReopenConfirmJob(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopeningLoading}
                onClick={handleExecuteReopen}
                className="px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" />
                {reopeningLoading ? 'Reopening Event...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── EVENT DETAILS MODAL ── */}
      <Modal isOpen={!!selectedJobId} onClose={() => setSelectedJobId(null)} title="Event Details" maxWidth="max-w-4xl">
        {selectedJobId &&
          (() => {
            const currentJob = jobs.find((j) => j._id === selectedJobId) || trashJobs.find((j) => j._id === selectedJobId);
            if (!currentJob) return null;

            const jobAsgs = assignments.filter((a) => String(a.jobId?._id || a.jobId || '') === String(currentJob._id));
            const jobPays = payments.filter((p) => String(p.jobId?._id || p.jobId || '') === String(currentJob._id));
            const jobAtts = attendances.filter((a) => String(a.jobId?._id || a.jobId || '') === String(currentJob._id));

            return (
              <div className="space-y-6">
                <EventLifecycleView job={currentJob} assignments={jobAsgs} payments={jobPays} attendances={jobAtts} />

                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-slate-400">
                      Assigned Staff Count: <strong className="text-white">{jobAsgs.length} Workers</strong>
                    </p>
                    {currentJob.completedAt && (
                      <p className="text-[11px] text-blue-400 mt-1">
                        Completed on: {formatDateTime(currentJob.completedAt)}
                      </p>
                    )}
                  </div>

                  {currentJob.status === 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCompleteConfirmJob(currentJob);
                        setCompleteNotes('');
                      }}
                      className="gradient-btn px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark as Completed
                    </button>
                  ) : currentJob.status === 'COMPLETED' ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        <span>Event Completed & Worker Payouts Initiated</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReopenConfirmJob(currentJob);
                          setReopenNotes('');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl font-bold transition-all shadow-sm"
                      >
                        <RefreshCcw className="w-4 h-4" /> Reopen Event
                      </button>
                    </div>
                  ) : (
                    <StatusBadge status={currentJob.status} />
                  )}
                </div>
              </div>
            );
          })()}
      </Modal>

      {/* ── MOVE TO TRASH CONFIRM MODAL ── */}
      <Modal isOpen={!!deleteConfirmJob} onClose={() => setDeleteConfirmJob(null)} title="Move Event to Trash?" maxWidth="max-w-md">
        {deleteConfirmJob && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">{deleteConfirmJob.title}</h4>
              <p className="text-slate-400 mt-2">
                This event will be moved to Trash. It can be restored or permanently deleted from Trash.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmJob(null)}
                className="px-5 py-2 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSoftDelete}
                className="px-5 py-2 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
              >
                Move to Trash
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── RESTORE CONFIRM MODAL ── */}
      <Modal isOpen={!!restoreConfirmJob} onClose={() => setRestoreConfirmJob(null)} title="Restore Event?" maxWidth="max-w-md">
        {restoreConfirmJob && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <RefreshCcw className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">{restoreConfirmJob.title}</h4>
              <p className="text-slate-400 mt-2">This event will be restored to the active list.</p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmJob(null)}
                className="px-5 py-2 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="px-5 py-2 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
              >
                Restore Event
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── PERMANENT DELETE CONFIRM MODAL ── */}
      <Modal isOpen={!!permanentDeleteConfirmJob} onClose={() => setPermanentDeleteConfirmJob(null)} title="Delete Permanently?" maxWidth="max-w-md">
        {permanentDeleteConfirmJob && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-red-900/50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">{permanentDeleteConfirmJob.title}</h4>
              <p className="text-red-400 mt-2 font-semibold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                Warning: This action cannot be undone.
                <br />
                The event will be permanently removed from the database.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => setPermanentDeleteConfirmJob(null)}
                className="px-5 py-2 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="px-5 py-2 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── UPDATE EVENT MODAL ── */}
      {updateJob && (
        <JobApprovalModal
          isOpen={true}
          onClose={() => setUpdateJob(null)}
          job={updateJob}
          onSubmitReview={handleUpdateEvent}
          isEventUpdate={true}
        />
      )}

      {/* ── BULK CONFIRM MODAL ── */}
      <BulkConfirmModal
        open={Boolean(bulkConfirm)}
        onClose={() => setBulkConfirm(null)}
        onConfirm={executeBulkAction}
        count={
          bulkConfirm?.target === 'trash'
            ? bulkTrash.selectedCount
            : bulkConfirm?.target === 'completed'
            ? bulkCompleted.selectedCount
            : bulkActive.selectedCount
        }
        actionLabel={bulkConfirm?.label}
        description={bulkConfirm?.desc}
        loading={bulkLoading}
        isDanger={bulkConfirm?.isDanger}
      />
    </div>
  );
};

export default AdminEvents;
