import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import userService from '../../services/userService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import {
  Search, ShieldAlert, KeyRound, RotateCcw, History, CheckCircle2, Ban,
  UserMinus, Eye, Trash2, AlertTriangle, Star, MapPin, Calendar,
  ChevronDown, ChevronUp, Briefcase, ClipboardList, Printer,
} from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';
import AdminRatingModal from '../../components/admin/AdminRatingModal';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar } from '../../components/admin/BulkActionComponents';
import { exportDetailedRecordsToPdf, exportWorker2PageReportPdf } from '../../utils/printPdfExport';
import { resolveAssetUrl } from '../../utils/assetUrl';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

const getAvailableStatuses = (currentStatus, isDeleted) => {
  if (isDeleted) return [];
  switch (currentStatus) {
    case 'ACTIVE':     return ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'];
    case 'SUSPENDED':  return ['ACTIVE', 'BLOCKED', 'DEACTIVATED'];
    case 'BLOCKED':    return ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
    case 'DEACTIVATED':return ['ACTIVE', 'SUSPENDED', 'BLOCKED'];
    default:           return ['ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED'];
  }
};

const STATUS_LABELS = {
  ACTIVE:      { label: 'Activate',   icon: CheckCircle2, className: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-600/30' },
  SUSPENDED:   { label: 'Suspend',    icon: ShieldAlert,  className: 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 border border-amber-600/30' },
  BLOCKED:     { label: 'Block',      icon: Ban,          className: 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 border border-rose-600/30' },
  DEACTIVATED: { label: 'Deactivate', icon: UserMinus,    className: 'bg-slate-600/20 text-slate-400 hover:bg-slate-600/40 border border-slate-600/30' },
};
const DESTRUCTIVE_STATUSES = ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'];

const InfoRow = ({ label, value }) =>
  value ? (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 w-36 shrink-0">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  ) : null;

export const AdminWorkers = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();

  const [workers, setWorkers]           = useState([]);
  const [loading, setLoading]           = useState(true);

  // ── Filter state (ALL defaults = show everything) ──
  const [searchTerm, setSearchTerm]         = useState('');
  const [selectedSkill, setSelectedSkill]   = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [dateFilter, setDateFilter]         = useState(DEFAULT_DATE_FILTER);

  // Detail view
  const [detailUser, setDetailUser]         = useState(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [expandedSection, setExpandedSection] = useState({ basic: true, profile: true, apps: true, assignments: true });

  // Manage modal
  const [actionWorker, setActionWorker]     = useState(null);
  const [actionType, setActionType]         = useState(null);
  const [ratingModalMode, setRatingModalMode] = useState('EDIT'); // 'EDIT' | 'REMOVE'
  const [pendingStatus, setPendingStatus]   = useState(null);
  const [actionReason, setActionReason]     = useState('');
  const [tempPassword, setTempPassword]     = useState('');
  const [historyLogs, setHistoryLogs]       = useState([]);
  const [actionLoading, setActionLoading]   = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleteReason, setDeleteReason]     = useState('');
  const [deleteLoading, setDeleteLoading]   = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setLoading(true);
    const res = await userService.getWorkers();
    if (res && res.success) setWorkers(res.data);
    setLoading(false);
  };

  /* ── Detail view ── */
  const openDetails = async (w) => {
    setDetailLoading(true);
    setDetailUser({ ...w, _loading: true });
    const userId = w.userId?._id || w._id;
    const res = await userService.getUserById(userId);
    if (res && res.success) {
      setDetailUser(res.data);
    } else {
      setDetailUser({ ...w, userId: w.userId });
    }
    setDetailLoading(false);
    setExpandedSection({ basic: true, profile: true, apps: true, assignments: true });
  };

  const toggleSection = (key) =>
    setExpandedSection((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ── Manage helpers ── */
  const openManage = (w) => {
    const userId = w.userId?._id || w._id;
    setActionWorker({ ...w, _userId: userId });
    setActionReason('');
    setTempPassword('');
    setPendingStatus(null);
    setActionType('MANAGE');
  };

  const closeAll = () => { setActionWorker(null); setActionType(null); setPendingStatus(null); };

  const requestStatusChange = (status) => {
    if (DESTRUCTIVE_STATUSES.includes(status)) { setPendingStatus(status); setActionType('CONFIRM_STATUS'); }
    else handleUpdateStatus(status);
  };

  const handleUpdateStatus = async (status) => {
    setActionLoading(true);
    try {
      const userId = actionWorker._userId || actionWorker.userId?._id || actionWorker._id;
      const res = await userService.updateUserStatus(userId, status, actionReason, adminUser);
      if (res && res.success) {
        setWorkers((prev) =>
          prev.map((u) => {
            const uid = u.userId?._id || u._id;
            return uid === userId ? { ...u, status, userId: { ...u.userId, status } } : u;
          })
        );
        showToast(status === 'ACTIVE' ? 'Worker reactivated.' : `Worker account ${status.toLowerCase()}.`, 'success');
        closeAll();
      } else {
        showToast(res?.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setActionLoading(true);
    try {
      const userId = actionWorker._userId || actionWorker.userId?._id || actionWorker._id;
      const res = await userService.resetUserPassword(userId, actionReason);
      if (res && res.success) { setTempPassword(res.temporaryPassword); showToast('Password reset.', 'success'); }
      else showToast(res?.message || 'Failed', 'error');
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleForcePasswordChange = async () => {
    setActionLoading(true);
    try {
      const userId = actionWorker._userId || actionWorker.userId?._id || actionWorker._id;
      const res = await userService.forceUserPasswordChange(userId, actionReason);
      if (res && res.success) { showToast('Force password change applied.', 'success'); closeAll(); }
      else showToast(res?.message || 'Failed', 'error');
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const fetchHistory = async (w) => {
    const userId = w._userId || w.userId?._id || w._id;
    const res = await userService.getUserHistory(userId);
    if (res && res.success) setHistoryLogs(res.history || []);
  };

  /* ── Delete ── */
  const openDelete = (w) => { setDeleteTarget(w); setDeleteReason(''); };
  const closeDelete = () => { setDeleteTarget(null); setDeleteReason(''); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const userId = deleteTarget.userId?._id || deleteTarget._id;
      const res = await userService.deleteUser(userId, deleteReason || 'Admin deleted account');
      if (res && res.success) {
        setWorkers((prev) => prev.filter((w) => {
          const uid = w.userId?._id || w._id;
          return uid !== userId;
        }));
        showToast(`Worker account deleted successfully.`, 'success');
        closeDelete();
        if (detailUser && (detailUser.id === userId || detailUser._id === userId)) {
          setDetailUser(null);
        }
      } else {
        showToast(res?.message || 'Failed to delete account', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to delete account', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Derived state — MUST be before any early return (Rules of Hooks) ── */
  const getDisplayStatus = (w) =>
    (w.isDeleted || w.userId?.isDeleted) ? 'DELETED' : (w.status || w.userId?.status || 'ACTIVE');

  const allSkills = useMemo(
    () => Array.from(new Set(workers.flatMap((w) => w.skills || []))).sort(),
    [workers]
  );

  const allLocations = useMemo(
    () =>
      Array.from(
        new Set(
          workers
            .map((w) => (w.location || '').trim())
            .filter(Boolean)
            .map((l) => l.charAt(0).toUpperCase() + l.slice(1).toLowerCase())
        )
      ).sort(),
    [workers]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return workers.filter((w) => {
      // Normal Workers registry must NEVER show deleted accounts
      if (w.isDeleted || w.userId?.isDeleted || w.status === 'DELETED' || w.userId?.status === 'DELETED') {
        return false;
      }
      const regDate = w.userId?.createdAt || w.createdAt;
      if (!matchesDateFilter(regDate, dateFilter)) return false;

      const name  = (w.fullName || '').toLowerCase();
      const email = (w.email || w.userId?.email || '').toLowerCase();
      const loc   = (w.location || '').toLowerCase();
      if (q && !name.includes(q) && !email.includes(q) && !loc.includes(q)) return false;
      if (selectedSkill !== 'ALL' && !(w.skills || []).includes(selectedSkill)) return false;
      if (selectedLocation !== 'ALL') {
        const wLoc = (w.location || '').trim().toLowerCase();
        if (wLoc !== selectedLocation.toLowerCase()) return false;
      }
      if (selectedStatus !== 'ALL') {
        if (getDisplayStatus(w) !== selectedStatus) return false;
      }
      return true;
    });
  }, [workers, searchTerm, selectedSkill, selectedLocation, selectedStatus, dateFilter]);

  const isFiltering =
    searchTerm !== '' ||
    selectedSkill !== 'ALL' ||
    selectedLocation !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    dateFilter.preset !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSkill('ALL');
    setSelectedLocation('ALL');
    setSelectedStatus('ALL');
    setDateFilter(DEFAULT_DATE_FILTER);
  };

  // Bulk selection (scoped to filtered list)
  const bulk = useBulkSelection(filtered);

  if (loading) return <LoadingSpinner label="Loading worker registry..." />;

  const dateStr = new Date().toISOString().slice(0, 10);
  const handleExportPdf = async () => {
    const selected = filtered.filter((w) => bulk.isSelected(w._id));
    if (selected.length === 0) {
      showToast('Please select at least one worker to print / export.', 'info');
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    showToast('Compiling complete 2-page worker report...', 'info');

    try {
      const fullWorkersData = await Promise.all(
        selected.map(async (w) => {
          const userId = (w.userId && typeof w.userId === 'object' && w.userId._id)
            ? w.userId._id
            : (typeof w.userId === 'string' ? w.userId : (w._userId || w._id));
          try {
            const res = await userService.getUserById(userId);
            if (res && res.success && res.data) {
              return res.data;
            }
          } catch (err) {
            console.error('Error fetching worker details for PDF export:', err);
          }
          return w;
        })
      );

      const targetWorkerName = selected.length === 1
        ? (selected[0].fullName || selected[0].profile?.fullName || 'Worker').replace(/[^a-zA-Z0-9]/g, '_')
        : 'Multiple';

      exportWorker2PageReportPdf({
        workers: fullWorkersData,
        filename: `JobbyHop_Worker_Report_${targetWorkerName}_${dateStr}.pdf`,
      });
    } catch (err) {
      console.error('Failed to generate worker PDF report:', err);
      showToast('Failed to generate worker PDF report.', 'error');
    }
  };

  const SectionHeader = ({ title, sectionKey, count }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-left"
    >
      <span className="font-bold text-white text-xs">
        {title} {count !== undefined && <span className="text-brand-400 ml-1">({count})</span>}
      </span>
      {expandedSection[sectionKey] ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
    </button>
  );

  return (
    <div className="space-y-5 pb-12 text-xs">
      {/* ── Header ── */}
      <div className="glass-card p-5 rounded-3xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              Event Staff Registry
              <span className="ml-2 text-brand-400">
                ({isFiltering ? `${filtered.length} of ${workers.length}` : workers.length})
              </span>
            </h1>
            <p className="text-slate-400 text-[11px] mt-0.5">Manage worker profiles, skills, availability, and account status.</p>
          </div>
          {isFiltering && (
            <button
              onClick={clearFilters}
              className="shrink-0 px-4 py-2 rounded-xl bg-rose-600/15 text-rose-400 border border-rose-600/30 hover:bg-rose-600/30 font-bold transition-colors"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500"
            placeholder="Search name, email, or location..."
          />
        </div>

        {/* ── Filter row ── */}
        <div className="flex flex-wrap gap-2">
          {/* Skill dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Skill</span>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-semibold cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="ALL">All Skills</option>
              {allSkills.map((sk) => (
                <option key={sk} value={sk}>{sk}</option>
              ))}
            </select>
          </div>

          {/* Location dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Location</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-semibold cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="ALL">All Locations</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Status dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Status</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-semibold cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Registered Date</span>
            <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          </div>
        </div>
      </div>

      {/* Bulk toolbar */}
      <BulkActionToolbar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clearSelection}
        visible={bulk.selectedCount > 0}
        actions={[
          { label: 'Print / Save PDF', icon: Printer, onClick: handleExportPdf },
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
                    id="worker-select-all"
                    checked={bulk.isAllSelected}
                    indeterminate={bulk.isIndeterminate}
                    onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                  />
                </th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Skills</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-slate-300 font-bold text-sm mb-1">No workers found.</p>
                    <p className="text-slate-500">{isFiltering ? 'Try changing your search or filters.' : 'No worker accounts registered yet.'}</p>
                    {isFiltering && (
                      <button onClick={clearFilters} className="mt-3 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors">
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((w) => {
                  const email = w.email || w.userId?.email || '—';
                  const status = w.status || w.userId?.status || 'ACTIVE';
                  const created = w.userId?.createdAt || w.createdAt;
                  const mustChangePW = w.mustChangePassword || w.userId?.mustChangePassword;
                  return (
                    <tr key={w._id} className={`hover:bg-slate-800/40 transition-colors ${bulk.isSelected(w._id) ? 'bg-brand-500/5' : ''}`}>
                      <td className="px-4 py-3.5 w-10">
                        <BulkCheckbox
                          id={`worker-cb-${w._id}`}
                          checked={bulk.isSelected(w._id)}
                          onChange={() => bulk.toggleSelection(w._id)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {w.profilePhoto ? (
                            <img src={resolveAssetUrl(w.profilePhoto)} alt={w.fullName} className="w-9 h-9 rounded-xl object-cover border border-slate-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 font-bold">
                              {(w.fullName || 'W')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white text-sm">{w.fullName || '—'}</p>
                            <p className="text-slate-400 text-[11px]">{email}</p>
                            {mustChangePW && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                <KeyRound className="w-2.5 h-2.5" /> Must Change PW
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(w.skills || []).slice(0, 3).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-semibold">{s}</span>
                          ))}
                          {(w.skills || []).length > 3 && (
                            <span className="text-slate-500 text-[10px]">+{w.skills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">{w.location || '—'}</td>
                      <td className="px-4 py-3.5">
                        {w.rating != null && w.rating >= 1 && w.rating <= 5 ? (
                          <span className="text-yellow-400 whitespace-nowrap font-bold">
                            {Array.from({ length: 5 }, (_, i) => i < w.rating ? '⭐' : '☆').join('')} {w.rating}/5
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={(w.isDeleted || w.userId?.isDeleted) ? 'DELETED' : (w.status || w.userId?.status || 'ACTIVE')} /></td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {created ? new Date(created).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            id={`view-worker-${w._id}`}
                            onClick={() => openDetails(w)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button
                            id={`manage-worker-${w._id}`}
                            onClick={() => openManage(w)}
                            className="px-2.5 py-1.5 rounded-lg bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 font-semibold"
                          >
                            Manage
                          </button>
                          <button
                            id={`delete-worker-${w._id}`}
                            onClick={() => openDelete(w)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 font-semibold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── COMPLETE DETAIL VIEW MODAL ── */}
      {detailUser && (
        <Modal
          isOpen={true}
          onClose={() => setDetailUser(null)}
          title={`Worker Profile: ${detailUser.profile?.fullName || detailUser.fullName || detailUser.email || '—'}`}
          maxWidth="max-w-3xl"
        >
          {detailUser._loading || detailLoading ? (
            <div className="py-12 flex justify-center"><LoadingSpinner label="Loading full profile..." /></div>
          ) : (
            <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">

              {/* Basic Info */}
              <SectionHeader title="Basic Information" sectionKey="basic" />
              {expandedSection.basic && (
                <div className="px-1 space-y-2 py-2">
                  <div className="flex items-center gap-4 mb-3">
                    {(detailUser.profile?.profilePhoto || detailUser.profilePhoto) && (
                      <img src={resolveAssetUrl(detailUser.profile?.profilePhoto || detailUser.profilePhoto)} alt={detailUser.profile?.fullName || detailUser.fullName}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500" />
                    )}
                    <div>
                      <p className="text-lg font-bold text-white">{detailUser.profile?.fullName || detailUser.fullName}</p>
                      <p className="text-slate-400">{detailUser.email}</p>
                    </div>
                  </div>
                  <InfoRow label="Phone"           value={detailUser.phone || detailUser.profile?.phone} />
                  <InfoRow label="Role"            value={detailUser.role} />
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-36 shrink-0">Account Status</span>
                    <StatusBadge status={(detailUser.isDeleted || detailUser.userId?.isDeleted) ? 'DELETED' : (detailUser.status || detailUser.userId?.status || 'ACTIVE')} />
                  </div>
                  <InfoRow label="Registered"      value={detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleString() : undefined} />
                  <InfoRow label="Last Updated"    value={detailUser.updatedAt ? new Date(detailUser.updatedAt).toLocaleString() : undefined} />
                  {detailUser.mustChangePassword && (
                    <div className="flex items-center gap-2 text-orange-400 font-semibold">
                      <KeyRound className="w-3 h-3" /> Password change required on next login
                    </div>
                  )}
                </div>
              )}

              {/* Profile Info */}
              <SectionHeader title="Profile Information" sectionKey="profile" />
              {expandedSection.profile && (
                <div className="px-1 space-y-2 py-2">
                  <InfoRow label="Date of Birth"   value={detailUser.profile?.dob ? new Date(detailUser.profile.dob).toLocaleDateString() : undefined} />
                  <InfoRow label="Location"         value={detailUser.profile?.location} />
                  {detailUser.profile?.rating != null && detailUser.profile.rating >= 1 && detailUser.profile.rating <= 5 ? (
                    <div className="flex gap-2 text-xs items-center py-1">
                      <span className="text-slate-400 w-36 shrink-0">Rating</span>
                      <span className="text-yellow-400 font-bold flex items-center gap-1.5 whitespace-nowrap">
                        {Array.from({ length: 5 }, (_, i) => i < detailUser.profile.rating ? '⭐' : '☆').join('')} {detailUser.profile.rating}/5
                      </span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button onClick={() => { setActionWorker(detailUser); setRatingModalMode('EDIT'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700">Change Rating</button>
                        <button onClick={() => { setActionWorker(detailUser); setRatingModalMode('REMOVE'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 font-bold border border-rose-500/30">Remove Rating</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 text-xs items-center py-1">
                      <span className="text-slate-400 w-36 shrink-0"></span>
                      <button onClick={() => { setActionWorker(detailUser); setRatingModalMode('EDIT'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 font-bold border border-brand-500/30">Give Rating</button>
                    </div>
                  )}
                  <InfoRow label="Total Assignments" value={detailUser.profile?.totalAssignments?.toString()} />
                  <InfoRow label="Completed Events" value={(detailUser.completedEventsCount || detailUser.profile?.completedEventsCount)?.toString()} />
                  {detailUser.profile?.bio && (
                    <div className="pt-1">
                      <p className="text-slate-400 mb-1">Bio</p>
                      <p className="text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800">{detailUser.profile.bio}</p>
                    </div>
                  )}
                  {detailUser.profile?.skills && detailUser.profile.skills.length > 0 && (
                    <div>
                      <p className="text-slate-400 mb-1">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailUser.profile.skills.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailUser.profile?.experience && detailUser.profile.experience.length > 0 && (
                    <div>
                      <p className="text-slate-400 mb-1">Experience</p>
                      <div className="space-y-1.5">
                        {detailUser.profile.experience.map((exp, i) => (
                          <div key={i} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                            <p className="font-semibold text-white">{exp.title}</p>
                            {exp.eventType && <p className="text-slate-400 text-[10px]">{exp.eventType} • {exp.duration}</p>}
                            {exp.description && <p className="text-slate-300 mt-1">{exp.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailUser.profile?.availability && (
                    <div>
                      <p className="text-slate-400 mb-1">Availability</p>
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                        <p className={detailUser.profile.availability.isAvailable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {detailUser.profile.availability.isAvailable ? '✓ Available for shifts' : '✗ Not available'}
                        </p>
                        {detailUser.profile.availability.preferredEventTypes?.length > 0 && (
                          <p className="text-slate-400">Preferred: {detailUser.profile.availability.preferredEventTypes.join(', ')}</p>
                        )}
                        {detailUser.profile.availability.availableTimeSlots?.length > 0 && (
                          <p className="text-slate-400">Time Slots: {detailUser.profile.availability.availableTimeSlots.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Applications */}
              <SectionHeader title="Job Applications" sectionKey="apps" count={detailUser.applicationCount} />
              {expandedSection.apps && (
                <div className="px-1 py-2">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'Total',    value: detailUser.applicationCount || 0, color: 'text-white' },
                      { label: 'Assigned', value: detailUser.assignmentCount || 0,  color: 'text-emerald-400' },
                      { label: 'Completed',value: detailUser.completedEventsCount || 0, color: 'text-brand-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                        <p className="text-slate-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {detailUser.applications && detailUser.applications.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {detailUser.applications.map((a) => (
                        <div key={a._id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <div>
                            <p className="font-semibold text-white">{a.jobId?.title || 'Job'}</p>
                            <p className="text-slate-400 text-[10px]">{a.jobId?.eventType || '—'} • {a.jobId?.eventDate ? new Date(a.jobId.eventDate).toLocaleDateString() : ''} • ₹{a.jobId?.adminApprovedPayment || '—'}</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-3">No applications yet.</p>
                  )}
                </div>
              )}

              {/* Assignments */}
              <SectionHeader title="Assignments" sectionKey="assignments" count={detailUser.assignmentCount} />
              {expandedSection.assignments && (
                <div className="px-1 py-2">
                  {detailUser.assignments && detailUser.assignments.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {detailUser.assignments.map((a) => (
                        <div key={a._id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <div>
                            <p className="font-semibold text-white">{a.jobId?.title || 'Event'}</p>
                            <p className="text-slate-400 text-[10px]">{a.jobId?.eventType || '—'} • {getLocationString(a.jobId?.location)} • {a.jobId?.eventDate ? new Date(a.jobId.eventDate).toLocaleDateString() : ''}</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-3">No assignments yet.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 flex-wrap">
                <button
                  onClick={() => { setDetailUser(null); openManage(detailUser.profile ? { ...detailUser.profile, userId: detailUser } : detailUser); }}
                  className="flex-1 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 font-bold py-2.5 rounded-xl border border-brand-600/30 text-xs"
                >
                  Manage Account
                </button>
                <button
                  onClick={() => { setDetailUser(null); openDelete(detailUser.profile ? { ...detailUser.profile, userId: detailUser } : detailUser); }}
                  className="flex-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 font-bold py-2.5 rounded-xl border border-rose-600/30 text-xs inline-flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Account
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget && (
        <Modal isOpen={true} onClose={closeDelete} title="Delete Worker Account">
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-900/20 border border-rose-500/40 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-1">This action cannot be undone.</p>
                  <p className="text-slate-300">The worker account will be permanently deactivated. All historical data (applications, assignments, payments) will be preserved for audit purposes.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
              <p className="text-slate-400">Account to delete:</p>
              <p className="text-white font-bold">{deleteTarget.fullName || deleteTarget.profile?.fullName || '—'}</p>
              <p className="text-slate-300">{deleteTarget.email || deleteTarget.userId?.email || '—'}</p>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Reason for deletion (optional)</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-white resize-none"
                placeholder="Policy violation, fraudulent activity, etc."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={closeDelete} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
              <button
                id="confirm-delete-worker"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MANAGE ACCOUNT MODAL ── */}
      {actionWorker && actionType === 'MANAGE' && (
        <Modal isOpen={true} onClose={closeAll} title={`Manage: ${actionWorker.email || actionWorker.userId?.email}`}>
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Current Status:</span>
              <StatusBadge status={(actionWorker.isDeleted || actionWorker.userId?.isDeleted) ? 'DELETED' : (actionWorker.status || actionWorker.userId?.status || 'ACTIVE')} />
            </div>
            {(actionWorker.mustChangePassword || actionWorker.userId?.mustChangePassword) && (
              <div className="p-2 bg-orange-900/20 border border-orange-500/30 rounded-xl flex items-center gap-2 text-orange-400 text-[11px] font-semibold">
                <KeyRound className="w-3.5 h-3.5" /> User is flagged to change password on next login.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'manage-worker-change-status', icon: ShieldAlert, color: 'text-amber-400', label: 'Change Status',  type: 'STATUS' },
                { id: 'manage-worker-reset-password', icon: RotateCcw, color: 'text-sky-400',  label: 'Reset Password', type: 'RESET'  },
                { id: 'manage-worker-force-password', icon: KeyRound, color: 'text-orange-400', label: 'Force PW Change', type: 'FORCE' },
                { id: 'manage-worker-view-history',   icon: History, color: 'text-purple-400', label: 'View History',   type: 'HISTORY'},
                { id: 'manage-worker-rating',         icon: Star, color: 'text-yellow-400', label: 'Update Rating',   type: 'RATING'},
              ].map(({ id, icon: Icon, color, label, type }) => (
                <button
                  key={type} id={id}
                  onClick={() => {
                    setActionReason(''); setTempPassword('');
                    if (type === 'HISTORY') fetchHistory(actionWorker);
                    setActionType(type);
                  }}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-left font-bold text-white transition-colors flex items-center gap-2"
                >
                  <Icon className={`w-4 h-4 ${color}`} /> {label}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-3">
              <button
                onClick={() => { closeAll(); openDelete(actionWorker); }}
                className="w-full p-3 bg-rose-900/20 hover:bg-rose-900/40 rounded-xl font-bold text-rose-400 border border-rose-800/40 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── STATUS CHANGE MODAL ── */}
      {actionWorker && actionType === 'STATUS' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Change Account Status">
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Current Status:</span>
              <StatusBadge status={(actionWorker.isDeleted || actionWorker.userId?.isDeleted) ? 'DELETED' : (actionWorker.status || actionWorker.userId?.status || 'ACTIVE')} />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Reason (Optional)</label>
              <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {getAvailableStatuses(actionWorker.status || actionWorker.userId?.status, actionWorker.isDeleted || actionWorker.userId?.isDeleted).map((s) => {
                const cfg = STATUS_LABELS[s]; const Icon = cfg.icon;
                return (
                  <button key={s} id={`worker-status-btn-${s.toLowerCase()}`} onClick={() => requestStatusChange(s)}
                    className={`p-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors ${cfg.className}`}>
                    <Icon className="w-3.5 h-3.5" /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ── CONFIRM STATUS MODAL ── */}
      {actionWorker && actionType === 'CONFIRM_STATUS' && pendingStatus && (
        <Modal isOpen={true} onClose={() => setActionType('STATUS')} title={`Confirm: ${STATUS_LABELS[pendingStatus]?.label}`}>
          <div className="space-y-4 text-xs">
            <div className={`p-4 rounded-xl border ${pendingStatus === 'SUSPENDED' ? 'bg-amber-900/20 border-amber-500/40' : pendingStatus === 'BLOCKED' ? 'bg-rose-900/20 border-rose-500/40' : 'bg-slate-800 border-slate-700'}`}>
              <p className="font-bold text-white mb-1">Confirm {STATUS_LABELS[pendingStatus]?.label.toLowerCase()} this account?</p>
              <p className="text-slate-400">Account: <strong className="text-white">{actionWorker.email || actionWorker.userId?.email}</strong></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionType('STATUS')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
              <button id={`worker-confirm-status-${pendingStatus.toLowerCase()}`} onClick={() => handleUpdateStatus(pendingStatus)} disabled={actionLoading}
                className={`flex-1 py-2 rounded-xl font-bold text-white ${pendingStatus === 'SUSPENDED' ? 'bg-amber-600 hover:bg-amber-500' : pendingStatus === 'BLOCKED' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {actionLoading ? 'Processing...' : STATUS_LABELS[pendingStatus]?.label}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {actionWorker && actionType === 'RESET' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Reset Worker Password">
          <div className="space-y-4 text-xs">
            {tempPassword ? (
              <div className="p-4 bg-emerald-900/30 border border-emerald-500/50 rounded-xl">
                <p className="text-emerald-300 font-bold mb-2">Password reset successful.</p>
                <p className="text-slate-300 mb-1">Temporary password (shown once):</p>
                <div className="p-3 bg-slate-950 text-white font-mono rounded-lg text-lg text-center tracking-widest border border-slate-700 select-all">{tempPassword}</div>
                <p className="text-slate-400 mt-2 text-[11px]">User must change on next login.</p>
                <button onClick={closeAll} className="w-full mt-4 bg-slate-800 hover:bg-slate-700 py-2 rounded-xl font-bold text-white">Done</button>
              </div>
            ) : (
              <>
                <p className="text-slate-300">A secure temporary password will be generated.</p>
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl text-amber-400 text-[11px] font-semibold">⚠️ Existing password will be replaced immediately.</div>
                <div>
                  <label className="block text-slate-400 mb-1">Reason (Optional)</label>
                  <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setActionType('MANAGE')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
                  <button id="worker-confirm-reset-password" onClick={handleResetPassword} disabled={actionLoading} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl">
                    {actionLoading ? 'Resetting...' : 'Generate Temp Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── FORCE PW CHANGE MODAL ── */}
      {actionWorker && actionType === 'FORCE' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Force Password Change">
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">The worker will be required to set a new password on next login.</p>
            <div>
              <label className="block text-slate-400 mb-1">Reason (Optional)</label>
              <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionType('MANAGE')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
              <button id="worker-confirm-force-password" onClick={handleForcePasswordChange} disabled={actionLoading} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded-xl">
                {actionLoading ? 'Applying...' : 'Force Password Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── AUDIT HISTORY MODAL ── */}
      {actionWorker && actionType === 'HISTORY' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title={`Audit History: ${actionWorker.email || actionWorker.userId?.email}`} maxWidth="max-w-2xl">
          <div className="max-h-[60vh] overflow-y-auto space-y-2 text-xs">
            {historyLogs.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No audit logs found.</p>
            ) : (
              historyLogs.map((log) => (
                <div key={log._id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-brand-400">{log.action}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300">By: <span className="text-white">{log.performedByUserId?.email || 'Admin'}</span></p>
                  {log.notes && <p className="text-slate-400 mt-1 italic">{log.notes}</p>}
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* ── UPDATE RATING MODAL ── */}


      {/* ── ADMIN RATING MODAL ── */}
      {actionWorker && actionType === 'RATING' && (
        <AdminRatingModal
          isOpen={true}
          onClose={() => setActionType(detailUser ? null : 'MANAGE')}
          targetUser={actionWorker.userId || actionWorker}
          targetProfile={actionWorker.profile || actionWorker}
          currentRating={actionWorker.rating || actionWorker.profile?.rating}
          initialRemoveMode={ratingModalMode === 'REMOVE'}
          onRatingUpdated={(newRating) => {
            // Update local state for immediate UI refresh
            setWorkers((prev) => prev.map(w => w._id === actionWorker._id ? { ...w, rating: newRating } : w));
            if (detailUser && (detailUser._id === actionWorker._id || detailUser.userId?._id === actionWorker.userId?._id)) {
              setDetailUser({
                ...detailUser,
                profile: { ...detailUser.profile, rating: newRating }
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminWorkers;
