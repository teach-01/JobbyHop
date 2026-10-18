import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import attendanceService from '../../services/attendanceService';
import AttendanceModal from '../../components/admin/AttendanceModal';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { formatDisplayTime } from '../../utils/timeFormatters';
import { CalendarCheck, Plus, Clock, UserCheck, Trash2, RefreshCw, AlertTriangle, Printer } from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar, BulkConfirmModal } from '../../components/admin/BulkActionComponents';
import bulkAdminService from '../../services/bulkAdminService';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

/** Helper to render formatted or invalid time badges */
const renderTimeBadge = (timeVal, isCheckIn = true) => {
  const formatted = formatDisplayTime(timeVal);
  if (formatted.status === 'valid') {
    return (
      <span className={isCheckIn ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
        {formatted.label}
      </span>
    );
  }
  if (formatted.status === 'invalid') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold cursor-help"
        title={`Invalid saved time: "${formatted.raw}". Click Edit to correct.`}
      >
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        Invalid Time
      </span>
    );
  }
  return <span className="text-slate-500 font-normal">—</span>;
};

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
];

/** Case-insensitive partial-match search across attendance record fields */
const matchesSearch = (rec, query) => {
  if (!query) return true;
  const workerName = (rec.workerProfile?.fullName || '').toLowerCase();
  const workerEmail = (rec.workerId?.email || '').toLowerCase();
  const eventTitle = (rec.jobTitle || rec.jobId?.title || '').toLowerCase();
  const eventType = (rec.jobId?.eventType || '').toLowerCase();
  const eventLocation = getLocationString(rec.jobId?.location).toLowerCase();
  return (
    workerName.includes(query) ||
    workerEmail.includes(query) ||
    eventTitle.includes(query) ||
    eventType.includes(query) ||
    eventLocation.includes(query)
  );
};

export const AdminAttendance = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();
  
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'trash'
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [trashRecords, setTrashRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [selectedRecord, setSelectedRecord] = useState(null); // For Edit
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // For soft-delete
  const [restoreConfirmId, setRestoreConfirmId] = useState(null); // For restore
  const [permDeleteConfirmId, setPermDeleteConfirmId] = useState(null); // For permanent delete

  // Search & filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);
  const [trashSearchText, setTrashSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, trashRes] = await Promise.all([
        attendanceService.getAllAttendance(),
        attendanceService.getTrashAttendance()
      ]);

      if (attRes?.success) {
        setAttendanceRecords(attRes.data);
      } else if (attRes) {
        showToast(attRes.message || 'Failed to load attendance records', 'error');
        setAttendanceRecords([]);
      }

      if (trashRes?.success) {
        setTrashRecords(trashRes.data);
      } else if (trashRes) {
        setTrashRecords([]);
      }
    } catch (err) {
      showToast('Failed to load attendance data', 'error');
      setAttendanceRecords([]);
      setTrashRecords([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  // Derived filtered active attendance
  const filteredActive = useMemo(() => {
    let result = attendanceRecords;
    const query = searchText.trim().toLowerCase();

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Date filter
    if (dateFilter.preset !== 'all') {
      result = result.filter((r) => {
        const attDate = r.date || r.eventDate || r.jobId?.eventDate;
        return matchesDateFilter(attDate, dateFilter);
      });
    }

    // Search filter
    if (query) {
      result = result.filter((rec) => matchesSearch(rec, query));
    }

    return result;
  }, [attendanceRecords, searchText, statusFilter, dateFilter]);

  // Derived filtered trash
  const filteredTrash = useMemo(() => {
    let result = trashRecords;
    if (dateFilter.preset !== 'all') {
      result = result.filter((r) => {
        const attDate = r.date || r.eventDate || r.jobId?.eventDate;
        return matchesDateFilter(attDate, dateFilter);
      });
    }
    const query = trashSearchText.trim().toLowerCase();
    if (!query) return result;
    return result.filter((rec) => matchesSearch(rec, query));
  }, [trashRecords, trashSearchText, dateFilter]);

  const dateFilteredActive = useMemo(() => {
    if (dateFilter.preset === 'all') return attendanceRecords;
    return attendanceRecords.filter((r) => {
      const attDate = r.date || r.eventDate || r.jobId?.eventDate;
      return matchesDateFilter(attDate, dateFilter);
    });
  }, [attendanceRecords, dateFilter]);

  // Verified PRESENT count & calculated payable total (scoped to date filter)
  const verifiedPresentRecords = useMemo(() => {
    return dateFilteredActive.filter((r) => r.status === 'PRESENT' && r.verifiedByAdminId && !r.isDeleted);
  }, [dateFilteredActive]);

  const verifiedPayableTotal = useMemo(() => {
    const workerJobMap = new Map();
    for (const r of verifiedPresentRecords) {
      const jId = String(r.jobId?._id || r.jobId || '');
      const wId = String(r.workerId?._id || r.workerId || '');
      const key = `${jId}_${wId}`;
      if (!workerJobMap.has(key)) {
        const rate = Number(r.jobId?.adminApprovedPayment || r.jobId?.offeredAmountPerPerson || r.jobId?.recruiterProposedPayment || 0);
        workerJobMap.set(key, rate);
      }
    }
    return Array.from(workerJobMap.values()).reduce((sum, val) => sum + val, 0);
  }, [verifiedPresentRecords]);

  // Bulk Selection hooks
  const bulkActive = useBulkSelection(filteredActive);
  const bulkTrash = useBulkSelection(filteredTrash);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Bulk actions executor
  const executeBulkAction = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    const isTrash = bulkConfirm.target === 'trash';
    const ids = isTrash ? bulkTrash.selectedIdsArray : bulkActive.selectedIdsArray;
    let res;
    if (bulkConfirm.action === 'delete') {
      res = await bulkAdminService.bulkDeleteAttendance(ids);
    } else if (bulkConfirm.action === 'restore') {
      res = await bulkAdminService.bulkRestoreAttendance(ids);
    } else if (bulkConfirm.action === 'permanent') {
      res = await bulkAdminService.bulkPermanentDeleteAttendance(ids);
    }
    setBulkLoading(false);
    setBulkConfirm(null);
    if (res?.success) {
      showToast(res.message, 'success');
      if (isTrash) bulkTrash.clearSelection();
      else bulkActive.clearSelection();
      fetchData();
    } else {
      showToast(res?.message || 'Bulk operation failed', 'error');
    }
  };

  // Print / Save PDF export — complete attendance details
  const handleExportPdf = (isTrash = false) => {
    const list = isTrash ? filteredTrash : filteredActive;
    const bulkObj = isTrash ? bulkTrash : bulkActive;
    const selected = list.filter((rec) => bulkObj.isSelected(rec._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanSectionName = isTrash ? 'Attendance_Trash' : 'Attendance';
    exportDetailedRecordsToPdf({
      title: isTrash ? 'Attendance (Trash)' : 'Attendance',
      subtitle: isTrash ? 'Deleted Attendance Archive' : `Status Filter: ${statusFilter} — ${dateStr}`,
      filename: `JobbyHop_${cleanSectionName}_${dateStr}.pdf`,
      records: selected,
      buildCard: (r) => [
        {
          heading: 'Worker Information',
          color: '#8b5cf6',
          rows: [
            ['Worker Name',      r.workerProfile?.fullName || r.workerId?.fullName || r.workerId?.email],
            ['Worker Email',     r.workerId?.email],
            ['Worker Phone',     r.workerProfile?.phone || r.workerId?.phone],
            ['Worker ID',        r.workerId?._id || r.workerId],
          ],
        },
        {
          heading: 'Event / Shift Information',
          color: '#06b6d4',
          rows: [
            ['Event Title',      r.jobTitle || r.jobId?.title],
            ['Event Type',       r.jobId?.eventType],
            ['Event Date',       formatDate(r.date || r.eventDate || r.jobId?.eventDate)],
            ['Start Time',       r.jobId?.startTime],
            ['End Time',         r.jobId?.endTime],
            ['Location',         getLocationString(r.jobId?.location)],
            ['Venue / Address',  typeof r.jobId?.location === 'object' ? (r.jobId?.location?.venue || r.jobId?.location?.address) : null],
            ['Event Job ID',     r.jobId?._id || r.jobId],
          ],
        },
        {
          heading: 'Attendance Record',
          color: '#10b981',
          rows: [
            ['Attendance Status', r.status],
            ['Check-In Time',    formatDisplayTime(r.checkInTime).label],
            ['Check-Out Time',   formatDisplayTime(r.checkOutTime).label],
            ['Admin Notes',      r.notes],
            ['Recorded At',      formatDate(r.createdAt)],
            ['Record ID',        r._id],
          ],
        },
        ...(isTrash ? [{
          heading: 'Trash Information',
          color: '#ef4444',
          rows: [
            ['Deleted At',       formatDate(r.deletedAt)],
            ['Auto-Delete At',   formatDate(r.permanentDeleteAt)],
          ],
        }] : []),
      ],
    });
  };

  const handleSubmitAttendance = async (id, formData) => {
    try {
      const res = await attendanceService.markAttendanceByAdmin(id, formData, adminUser);
      if (res.success) {
        showToast('Worker shift attendance logged!', 'success');
        setSelectedRecord(null);
        await fetchData();
      } else {
        showToast(res.message || 'Failed to save attendance', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save attendance', 'error');
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteConfirmId) return;
    const res = await attendanceService.softDeleteAttendance(deleteConfirmId);
    if (res.success) {
      showToast('Attendance record moved to Trash.', 'success');
      setDeleteConfirmId(null);
      fetchData();
    } else {
      showToast(res.message || 'Failed to move to trash', 'error');
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirmId) return;
    const res = await attendanceService.restoreAttendance(restoreConfirmId);
    if (res.success) {
      showToast('Attendance record restored.', 'success');
      setRestoreConfirmId(null);
      fetchData();
    } else {
      showToast(res.message || 'Failed to restore', 'error');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteConfirmId) return;
    const res = await attendanceService.permanentDeleteAttendance(permDeleteConfirmId);
    if (res.success) {
      showToast('Attendance record permanently deleted.', 'success');
      setPermDeleteConfirmId(null);
      fetchData();
    } else {
      showToast(res.message || 'Failed to delete permanently', 'error');
    }
  };

  const calculateDaysRemaining = (permDateStr) => {
    if (!permDateStr) return 0;
    const diffTime = Math.max(0, new Date(permDateStr) - new Date());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) return <LoadingSpinner label="Loading shift attendance records..." />;

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Event Attendance & Check-In Tracking</h1>
          <p className="text-slate-400">Verify worker shift arrivals, departures, punctuality, and notes. Deleted records are retained in Trash for 30 days.</p>
        </div>
      </div>

      {/* Attendance & Payment Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Active Logs</span>
          <span className="text-xl font-extrabold text-white">{dateFilteredActive.length}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Logged Shift Records</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Verified Present</span>
          <span className="text-xl font-extrabold text-emerald-400">{verifiedPresentRecords.length}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Admin Verified Attendees</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/20 bg-amber-500/5">
          <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Pending / Absent</span>
          <span className="text-xl font-extrabold text-amber-400">
            {Math.max(0, dateFilteredActive.length - verifiedPresentRecords.length)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Unverified / Absent Logs</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/20 bg-purple-500/5">
          <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Verified Payable Total</span>
          <span className="text-xl font-extrabold text-purple-300">{formatCurrency(verifiedPayableTotal)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Verified Attendance Payout</span>
        </div>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-bold rounded-xl transition-all ${
            activeTab === 'active' 
              ? 'bg-brand-500 text-white shadow-[0_0_15px_rgba(var(--brand-500),0.3)]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Active Attendance ({attendanceRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-2 font-bold rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'trash' 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
              : 'text-slate-400 hover:text-red-400 hover:bg-slate-800/50'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Trash ({trashRecords.length})
        </button>
      </div>

      {/* ACTIVE ATTENDANCE TAB */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {/* Search + Filter toolbar */}
          <SearchFilterBar
            searchValue={searchText}
            onSearchChange={setSearchText}
            placeholder="Search worker or event..."
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterOptions={ATTENDANCE_STATUS_OPTIONS}
            totalCount={attendanceRecords.length}
            filteredCount={filteredActive.length}
            countLabel="attendance records"
          >
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </SearchFilterBar>

          {/* Bulk toolbar */}
          <BulkActionToolbar
            selectedCount={bulkActive.selectedCount}
            onClear={bulkActive.clearSelection}
            visible={bulkActive.selectedCount > 0}
            actions={[
              {
                label: 'Print / Save PDF',
                icon: Printer,
                onClick: () => handleExportPdf(false),
              },
              {
                label: 'Delete Selected',
                icon: Trash2,
                onClick: () => setBulkConfirm({
                  target: 'active',
                  action: 'delete',
                  label: 'Move to Trash',
                  desc: `Move ${bulkActive.selectedCount} attendance record(s) to trash?`,
                  isDanger: false,
                }),
                variant: 'danger',
              },
            ]}
          />

          <h2 className="text-base font-bold text-white">
            Logged Attendance Records ({filteredActive.length})
          </h2>

          {attendanceRecords.length === 0 ? (
            <EmptyState title="No Active Attendance Logs" description="No attendance records found." />
          ) : filteredActive.length === 0 ? (
            <EmptyState
              title="No attendance records match your search or filters."
              description="Try adjusting your search term or status filter."
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <BulkCheckbox
                          id="att-select-all"
                          checked={bulkActive.isAllSelected}
                          indeterminate={bulkActive.isIndeterminate}
                          onChange={() => bulkActive.isAllSelected ? bulkActive.clearSelection() : bulkActive.selectAll()}
                        />
                      </th>
                      <th className="px-4 py-3">Worker Name</th>
                      <th className="px-4 py-3">Event Job Title</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Check-In</th>
                      <th className="px-4 py-3">Check-Out</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Admin Verification Notes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredActive.map((rec) => (
                      <tr key={rec._id} className={`hover:bg-slate-800/40 transition-colors ${bulkActive.isSelected(rec._id) ? 'bg-brand-500/5' : ''}`}>
                        <td className="px-4 py-3.5 w-10">
                          <BulkCheckbox
                            id={`att-cb-${rec._id}`}
                            checked={bulkActive.isSelected(rec._id)}
                            onChange={() => bulkActive.toggleSelection(rec._id)}
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">{rec.workerProfile?.fullName || 'Worker'}</td>
                        <td className="px-4 py-3.5 font-semibold text-brand-300">{rec.jobTitle || rec.jobId?.title}</td>
                        <td className="px-4 py-3.5 text-slate-400">{formatDate(rec.date || rec.eventDate || rec.jobId?.eventDate)}</td>
                        <td className="px-4 py-3.5 font-bold">{renderTimeBadge(rec.checkInTime, true)}</td>
                        <td className="px-4 py-3.5 font-bold">{renderTimeBadge(rec.checkOutTime, false)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={rec.status} /></td>
                        <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate">{rec.notes || 'Verified'}</td>
                        <td className="px-4 py-3.5 text-right flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(rec._id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold transition-colors flex items-center justify-center"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRASH TAB */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-400">Trash Retention Policy</h3>
              <p className="text-slate-300 mt-1">
                Attendance records moved to Trash are retained for 30 days before being permanently deleted. 
                You can restore them during this period. Permanent deletion cannot be undone.
              </p>
            </div>
          </div>

          {/* Trash search */}
          <SearchFilterBar
            searchValue={trashSearchText}
            onSearchChange={setTrashSearchText}
            placeholder="Search trash records..."
            filterOptions={[]}
            totalCount={trashRecords.length}
            filteredCount={filteredTrash.length}
            countLabel="trash records"
          >
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </SearchFilterBar>

          {/* Trash Bulk Toolbar */}
          <BulkActionToolbar
            selectedCount={bulkTrash.selectedCount}
            onClear={bulkTrash.clearSelection}
            visible={bulkTrash.selectedCount > 0}
            actions={[
              {
                label: 'Print / Save PDF',
                icon: Printer,
                onClick: () => handleExportPdf(true),
              },
              {
                label: 'Restore Selected',
                icon: RefreshCw,
                onClick: () => setBulkConfirm({
                  target: 'trash',
                  action: 'restore',
                  label: 'Restore',
                  desc: `Restore ${bulkTrash.selectedCount} attendance record(s) from trash?`,
                  isDanger: false,
                }),
              },
              {
                label: 'Permanently Delete Selected',
                icon: Trash2,
                onClick: () => setBulkConfirm({
                  target: 'trash',
                  action: 'permanent',
                  label: 'Permanently Delete',
                  desc: `Permanently delete ${bulkTrash.selectedCount} attendance record(s)? This cannot be undone.`,
                  isDanger: true,
                }),
                variant: 'danger',
              },
            ]}
          />

          {trashRecords.length === 0 ? (
            <EmptyState title="Trash is Empty" description="No deleted attendance records." />
          ) : filteredTrash.length === 0 ? (
            <EmptyState
              title="No trash records match your search."
              description="Try adjusting your search term."
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <BulkCheckbox
                          id="att-trash-select-all"
                          checked={bulkTrash.isAllSelected}
                          indeterminate={bulkTrash.isIndeterminate}
                          onChange={() => bulkTrash.isAllSelected ? bulkTrash.clearSelection() : bulkTrash.selectAll()}
                        />
                      </th>
                      <th className="px-4 py-3">Worker Name</th>
                      <th className="px-4 py-3">Event Job Title</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Deleted At</th>
                      <th className="px-4 py-3">Permanent Delete</th>
                      <th className="px-4 py-3">Days Remaining</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredTrash.map((rec) => (
                      <tr key={rec._id} className={`hover:bg-slate-800/40 transition-colors ${bulkTrash.isSelected(rec._id) ? 'bg-rose-500/5' : ''}`}>
                        <td className="px-4 py-3.5 w-10">
                          <BulkCheckbox
                            id={`att-trash-cb-${rec._id}`}
                            checked={bulkTrash.isSelected(rec._id)}
                            onChange={() => bulkTrash.toggleSelection(rec._id)}
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">{rec.workerProfile?.fullName || 'Worker'}</td>
                        <td className="px-4 py-3.5 font-semibold text-brand-300">{rec.jobTitle || rec.jobId?.title}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={rec.status} /></td>
                        <td className="px-4 py-3.5 text-slate-400">{formatDate(rec.deletedAt)}</td>
                        <td className="px-4 py-3.5 text-red-400">{formatDate(rec.permanentDeleteAt)}</td>
                        <td className="px-4 py-3.5">
                          <span className="bg-slate-800 px-2.5 py-1 rounded-md text-slate-300 font-bold">
                            {calculateDaysRemaining(rec.permanentDeleteAt)} days
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right flex justify-end gap-2">
                          <button
                            onClick={() => setRestoreConfirmId(rec._id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-4 h-4" /> Restore
                          </button>
                          <button
                            onClick={() => setPermDeleteConfirmId(rec._id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 font-semibold transition-colors"
                          >
                            Delete Permanently
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Attendance Modal */}
      {selectedRecord && (
        <AttendanceModal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          attendanceRecord={selectedRecord}
          onSubmitAttendance={handleSubmitAttendance}
        />
      )}

      {/* Move to Trash Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Move to Trash?">
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">
            This attendance record will remain in Trash for 30 days before permanent deletion.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteConfirmId(null);
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSoftDelete();
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Move to Trash
            </button>
          </div>
        </div>
      </Modal>

      {/* Restore Modal */}
      <Modal isOpen={!!restoreConfirmId} onClose={() => setRestoreConfirmId(null)} title="Restore Attendance?">
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">
            This attendance record will be moved back to the active list.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRestoreConfirmId(null);
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRestore();
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
            >
              Restore
            </button>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete Modal */}
      <Modal isOpen={!!permDeleteConfirmId} onClose={() => setPermDeleteConfirmId(null)} title="Delete Permanently?">
        <div className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warning: This action cannot be undone.
            </p>
            <p className="text-slate-300 text-xs mt-2">
              Are you sure you want to permanently delete this attendance record? This will not affect other system records like jobs, payments, or workers.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPermDeleteConfirmId(null);
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePermanentDelete();
              }}
              className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Confirm Modal */}
      <BulkConfirmModal
        open={Boolean(bulkConfirm)}
        onClose={() => setBulkConfirm(null)}
        onConfirm={executeBulkAction}
        count={bulkConfirm?.target === 'trash' ? bulkTrash.selectedCount : bulkActive.selectedCount}
        actionLabel={bulkConfirm?.label}
        description={bulkConfirm?.desc}
        loading={bulkLoading}
        isDanger={bulkConfirm?.isDanger}
      />

    </div>
  );
};

export default AdminAttendance;
