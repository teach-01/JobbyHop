import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import userService from '../../services/userService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import {
  Search, Building2, Phone, Mail, MapPin, ShieldAlert, KeyRound, RotateCcw,
  Calendar, AlertTriangle, ChevronDown, ChevronUp, Star,
  CheckCircle2, Ban, UserMinus, Eye, Trash2, History, Printer,
} from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';
import AdminRatingModal from '../../components/admin/AdminRatingModal';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar } from '../../components/admin/BulkActionComponents';
import { exportDetailedRecordsToPdf } from '../../utils/printPdfExport';
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

export const AdminRecruiters = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useNotifications();

  const [recruiters, setRecruiters]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [dateFilter, setDateFilter]         = useState(DEFAULT_DATE_FILTER);

  // Detail view
  const [detailUser, setDetailUser]         = useState(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [expandedSection, setExpandedSection] = useState({ basic: true, profile: true, jobs: true, apps: true });

  // Manage modal
  const [actionRec, setActionRec]           = useState(null);
  const [actionType, setActionType]         = useState(null);
  const [ratingModalMode, setRatingModalMode] = useState('EDIT');
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
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    setLoading(true);
    const res = await userService.getRecruiters();
    if (res && res.success) setRecruiters(res.data);
    setLoading(false);
  };

  /* ── View Details ── */
  const openDetails = async (rec) => {
    setDetailLoading(true);
    setDetailUser({ ...rec, _loading: true });
    const userId = rec.userId?._id || rec._id;
    const res = await userService.getUserById(userId);
    if (res && res.success) {
      setDetailUser(res.data);
    } else {
      // Fallback: show basic info from list
      setDetailUser({ ...rec, userId: rec.userId });
    }
    setDetailLoading(false);
    setExpandedSection({ basic: true, profile: true, jobs: true, apps: true });
  };

  const toggleSection = (key) =>
    setExpandedSection((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ── Manage helpers ── */
  const openManage = (rec) => {
    const userId = rec.userId?._id || rec._id;
    setActionRec({ ...rec, _userId: userId });
    setActionReason('');
    setTempPassword('');
    setPendingStatus(null);
    setActionType('MANAGE');
  };

  const closeAll = () => { setActionRec(null); setActionType(null); setPendingStatus(null); };

  const requestStatusChange = (status) => {
    if (DESTRUCTIVE_STATUSES.includes(status)) { setPendingStatus(status); setActionType('CONFIRM_STATUS'); }
    else handleUpdateStatus(status);
  };

  const handleUpdateStatus = async (status) => {
    setActionLoading(true);
    try {
      const userId = actionRec._userId || actionRec.userId?._id || actionRec._id;
      const res = await userService.updateUserStatus(userId, status, actionReason, adminUser);
      if (res && res.success) {
        setRecruiters((prev) =>
          prev.map((u) => {
            const uid = u.userId?._id || u._id;
            return uid === userId ? { ...u, status, userId: { ...u.userId, status } } : u;
          })
        );
        showToast(
          status === 'ACTIVE' ? 'Recruiter reactivated.' : `Recruiter account ${status.toLowerCase()}.`,
          'success'
        );
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
      const userId = actionRec._userId || actionRec.userId?._id || actionRec._id;
      const res = await userService.resetUserPassword(userId, actionReason);
      if (res && res.success) { setTempPassword(res.temporaryPassword); showToast('Password reset.', 'success'); }
      else showToast(res?.message || 'Failed', 'error');
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleForcePasswordChange = async () => {
    setActionLoading(true);
    try {
      const userId = actionRec._userId || actionRec.userId?._id || actionRec._id;
      const res = await userService.forceUserPasswordChange(userId, actionReason);
      if (res && res.success) { showToast('Force password change applied.', 'success'); closeAll(); }
      else showToast(res?.message || 'Failed', 'error');
    } catch (err) { showToast(err?.message || 'Failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const fetchHistory = async (rec) => {
    const userId = rec._userId || rec.userId?._id || rec._id;
    const res = await userService.getUserHistory(userId);
    if (res && res.success) setHistoryLogs(res.history || []);
  };

  /* ── Delete ── */
  const openDelete = (rec) => { setDeleteTarget(rec); setDeleteReason(''); };
  const closeDelete = () => { setDeleteTarget(null); setDeleteReason(''); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const userId = deleteTarget.userId?._id || deleteTarget._id;
      const res = await userService.deleteUser(userId, deleteReason || 'Admin deleted account');
      if (res && res.success) {
        setRecruiters((prev) => prev.filter((r) => {
          const uid = r.userId?._id || r._id;
          return uid !== userId;
        }));
        showToast(`Recruiter account (${deleteTarget.email || deleteTarget.userId?.email}) deleted successfully.`, 'success');
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recruiters.filter((r) => {
      const regDate = r.userId?.createdAt || r.createdAt;
      if (!matchesDateFilter(regDate, dateFilter)) return false;
      const email = r.email || r.userId?.email || '';
      const name  = r.fullName || '';
      const company = r.companyName || '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || company.toLowerCase().includes(q);
    });
  }, [recruiters, search, dateFilter]);

  // Bulk selection (scoped to filtered list)
  const bulk = useBulkSelection(filtered);

  if (loading) return <LoadingSpinner label="Loading recruiter registry..." />;

  const handleExportPdf = () => {
    const selected = filtered.filter((r) => bulk.isSelected(r._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportDetailedRecordsToPdf({
      title: 'Recruiters',
      subtitle: `Event Recruiter Registry — Search: "${search || 'All'}" — ${dateStr}`,
      filename: `JobbyHop_Recruiters_${dateStr}.pdf`,
      records: selected,
      buildCard: (r) => [
        {
          heading: 'Company / Agency',
          color: '#8b5cf6',
          rows: [
            ['Company Name',     r.companyName || r.profile?.companyName],
            ['Contact Name',     r.fullName || r.profile?.fullName],
            ['Account Status',   (r.isDeleted || r.userId?.isDeleted) ? 'DELETED' : (r.status || r.userId?.status || 'ACTIVE')],
            ['Rating',           (r.rating != null || r.profile?.rating != null) ? `${r.rating ?? r.profile?.rating}/5` : null],
            ['Recruiter ID',     r.userId?._id || r._id],
          ],
        },
        {
          heading: 'Contact Information',
          color: '#06b6d4',
          rows: [
            ['Email',    r.email || r.userId?.email],
            ['Phone',    r.phone || r.userId?.phone || r.profile?.phone],
            ['Location', r.location || r.profile?.location],
          ],
        },
        {
          heading: 'Profile Details',
          color: '#10b981',
          rows: [
            ['Bio / Description',   r.bio || r.description || r.profile?.companyDescription],
            ['Website',            r.website || r.profile?.website],
            ['Business Experience', r.businessExperience || r.profile?.businessExperience],
            ['Registered At',      r.userId?.createdAt || r.createdAt
              ? new Date(r.userId?.createdAt || r.createdAt).toLocaleDateString('en-IN') : null],
            ['Last Updated',       r.userId?.updatedAt || r.updatedAt
              ? new Date(r.userId?.updatedAt || r.updatedAt).toLocaleDateString('en-IN') : null],
          ],
        },
        {
          heading: 'Job Submission History',
          color: '#f59e0b',
          rows: [
            ['Total Jobs Posted',    r.totalJobsSubmitted ?? r.jobsPosted ?? r.totalJobs ?? r.profile?.totalJobsSubmitted],
            ['Approved Jobs Count',  r.approvedJobsCount || r.profile?.approvedJobsCount],
            ['Active Jobs',          r.activeJobs],
            ['Completed Jobs',       r.completedJobs],
          ],
        },
      ],
    });
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
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Event Recruiter Management</h1>
          <p className="text-slate-400">View agency profiles, job submission logs, and account statuses. ({filtered.length} recruiters)</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white"
              placeholder="Search company or email..."
            />
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
                    id="rec-select-all"
                    checked={bulk.isAllSelected}
                    indeterminate={bulk.isIndeterminate}
                    onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                  />
                </th>
                <th className="px-4 py-3">Company & Contact</th>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No recruiters found.</td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const email  = rec.email || rec.userId?.email || '—';
                  const status = rec.status || rec.userId?.status || 'ACTIVE';
                  const created = rec.userId?.createdAt || rec.createdAt;
                  const mustChangePW = rec.mustChangePassword || rec.userId?.mustChangePassword;
                  return (
                    <tr key={rec._id} className={`hover:bg-slate-800/40 transition-colors ${bulk.isSelected(rec._id) ? 'bg-brand-500/5' : ''}`}>
                      <td className="px-4 py-3.5 w-10">
                        <BulkCheckbox
                          id={`rec-cb-${rec._id}`}
                          checked={bulk.isSelected(rec._id)}
                          onChange={() => bulk.toggleSelection(rec._id)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {rec.companyLogo ? (
                            <img src={rec.companyLogo} alt={rec.companyName} className="w-9 h-9 rounded-xl object-cover border border-slate-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-brand-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white text-sm">{rec.companyName || 'Company'}</p>
                            <p className="text-slate-400 text-[11px]">{rec.fullName} • {email}</p>
                            {mustChangePW && (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                <KeyRound className="w-2.5 h-2.5" /> Must Change PW
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">{rec.location || '—'}</td>
                      <td className="px-4 py-3.5">
                        {rec.rating != null && rec.rating >= 1 && rec.rating <= 5 ? (
                          <span className="text-yellow-400 whitespace-nowrap font-bold">
                            {Array.from({ length: 5 }, (_, i) => i < rec.rating ? '⭐' : '☆').join('')} {rec.rating}/5
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={(rec.isDeleted || rec.userId?.isDeleted) ? 'DELETED' : (rec.status || rec.userId?.status || 'ACTIVE')} /></td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {created ? new Date(created).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            id={`view-recruiter-${rec._id}`}
                            onClick={() => openDetails(rec)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button
                            id={`manage-recruiter-${rec._id}`}
                            onClick={() => openManage(rec)}
                            className="px-2.5 py-1.5 rounded-lg bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 font-semibold"
                          >
                            Manage
                          </button>
                          <button
                            id={`delete-recruiter-${rec._id}`}
                            onClick={() => openDelete(rec)}
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
          title={`Recruiter Profile: ${detailUser.profile?.companyName || detailUser.companyName || detailUser.email || '—'}`}
          maxWidth="max-w-3xl"
        >
          {detailUser._loading || detailLoading ? (
            <div className="py-12 flex justify-center"><LoadingSpinner label="Loading full profile..." /></div>
          ) : (
            <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">

              {/* Basic Information */}
              <SectionHeader title="Basic Information" sectionKey="basic" />
              {expandedSection.basic && (
                <div className="px-1 space-y-2 py-2">
                  <InfoRow label="Full Name"      value={detailUser.profile?.fullName || detailUser.fullName} />
                  <InfoRow label="Email"           value={detailUser.email} />
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

              {/* Company / Profile */}
              <SectionHeader title="Company & Profile" sectionKey="profile" />
              {expandedSection.profile && (
                <div className="px-1 space-y-2 py-2">
                  {(detailUser.profile?.companyLogo) && (
                    <img
                      src={detailUser.profile.companyLogo}
                      alt="Company Logo"
                      className="w-16 h-16 rounded-xl object-contain border border-slate-700 bg-slate-900"
                    />
                  )}
                  <InfoRow label="Company Name"     value={detailUser.profile?.companyName} />
                  <InfoRow label="Location"         value={detailUser.profile?.location} />
                  {detailUser.profile?.rating != null && detailUser.profile.rating >= 1 && detailUser.profile.rating <= 5 ? (
                    <div className="flex gap-2 text-xs items-center py-1">
                      <span className="text-slate-400 w-36 shrink-0">Rating</span>
                      <span className="text-yellow-400 font-bold flex items-center gap-1.5 whitespace-nowrap">
                        {Array.from({ length: 5 }, (_, i) => i < detailUser.profile.rating ? '⭐' : '☆').join('')} {detailUser.profile.rating}/5
                      </span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button onClick={() => { setActionRec(detailUser); setRatingModalMode('EDIT'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700">Change Rating</button>
                        <button onClick={() => { setActionRec(detailUser); setRatingModalMode('REMOVE'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 font-bold border border-rose-500/30">Remove Rating</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 text-xs items-center py-1">
                      <span className="text-slate-400 w-36 shrink-0"></span>
                      <button onClick={() => { setActionRec(detailUser); setRatingModalMode('EDIT'); setActionType('RATING'); }} className="px-2 py-1 rounded bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 font-bold border border-brand-500/30">Give Rating</button>
                    </div>
                  )}
                  <InfoRow label="Business Exp."    value={detailUser.profile?.businessExperience} />
                  <InfoRow label="Approved Jobs"    value={detailUser.profile?.approvedJobsCount?.toString()} />
                  <InfoRow label="Total Submitted"  value={detailUser.profile?.totalJobsSubmitted?.toString()} />
                  {detailUser.profile?.companyDescription && (
                    <div className="pt-1">
                      <p className="text-slate-400 mb-1">Company Description</p>
                      <p className="text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800">
                        {detailUser.profile.companyDescription}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Jobs */}
              <SectionHeader title="Jobs Posted" sectionKey="jobs" count={detailUser.jobCount} />
              {expandedSection.jobs && (
                <div className="px-1 py-2 space-y-2">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[
                      { label: 'Total',     value: detailUser.jobCount || 0,         color: 'text-white' },
                      { label: 'Pending',   value: detailUser.pendingJobsCount || 0,  color: 'text-amber-400' },
                      { label: 'Approved',  value: detailUser.approvedJobsCount || 0, color: 'text-emerald-400' },
                      { label: 'Rejected',  value: detailUser.rejectedJobsCount || 0, color: 'text-rose-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                        <p className="text-slate-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {detailUser.jobs && detailUser.jobs.length > 0 ? (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {detailUser.jobs.map((j) => (
                        <div key={j._id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <div>
                            <p className="font-semibold text-white">{j.title}</p>
                            <p className="text-slate-400 text-[10px]">{j.eventType} • {getLocationString(j.location)} • {j.eventDate ? new Date(j.eventDate).toLocaleDateString() : '—'}</p>
                          </div>
                          <StatusBadge status={j.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-3">No jobs posted yet.</p>
                  )}
                </div>
              )}

              {/* Applications on their jobs */}
              <SectionHeader title="Worker Applications on Their Jobs" sectionKey="apps" count={detailUser.applicationCount} />
              {expandedSection.apps && (
                <div className="px-1 py-2 space-y-1.5 max-h-52 overflow-y-auto">
                  {detailUser.applications && detailUser.applications.length > 0 ? (
                    detailUser.applications.map((a) => (
                      <div key={a._id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                        <div>
                          <p className="font-semibold text-white">{a.jobId?.title || 'Job'}</p>
                          <p className="text-slate-400 text-[10px]">Worker: {a.workerId?.email || '—'} • {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</p>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-center py-3">No applications on their jobs.</p>
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
        <Modal isOpen={true} onClose={closeDelete} title="Delete Recruiter Account">
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-900/20 border border-rose-500/40 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-1">This action cannot be undone.</p>
                  <p className="text-slate-300">The recruiter account will be permanently deactivated. All historical data (jobs, applications, assignments) will be preserved for audit purposes.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
              <p className="text-slate-400">Account to delete:</p>
              <p className="text-white font-bold">{deleteTarget.fullName || deleteTarget.profile?.fullName || '—'}</p>
              <p className="text-slate-300">{deleteTarget.email || deleteTarget.userId?.email || '—'}</p>
              {(deleteTarget.companyName || deleteTarget.profile?.companyName) && (
                <p className="text-slate-400 text-[11px]">{deleteTarget.companyName || deleteTarget.profile?.companyName}</p>
              )}
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
              <button onClick={closeDelete} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">
                Cancel
              </button>
              <button
                id="confirm-delete-recruiter"
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

      {/* ── MANAGE ACCOUNT MODAL (hub) ── */}
      {actionRec && actionType === 'MANAGE' && (
        <Modal isOpen={true} onClose={closeAll} title={`Manage: ${actionRec.email || actionRec.userId?.email}`}>
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Current Status:</span>
              <StatusBadge status={(actionRec.isDeleted || actionRec.userId?.isDeleted) ? 'DELETED' : (actionRec.status || actionRec.userId?.status || 'ACTIVE')} />
            </div>
            {(actionRec.mustChangePassword || actionRec.userId?.mustChangePassword) && (
              <div className="p-2 bg-orange-900/20 border border-orange-500/30 rounded-xl flex items-center gap-2 text-orange-400 text-[11px] font-semibold">
                <KeyRound className="w-3.5 h-3.5" /> User is flagged to change password on next login.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'manage-change-status', icon: ShieldAlert, color: 'text-amber-400', label: 'Change Status',  type: 'STATUS' },
                { id: 'manage-reset-password', icon: RotateCcw, color: 'text-sky-400',  label: 'Reset Password', type: 'RESET'  },
                { id: 'manage-force-password', icon: KeyRound, color: 'text-orange-400', label: 'Force PW Change', type: 'FORCE' },
                { id: 'manage-view-history',   icon: History, color: 'text-purple-400', label: 'View History',   type: 'HISTORY'},
                { id: 'manage-recruiter-rating', icon: Star, color: 'text-yellow-400', label: 'Update Rating',  type: 'RATING'},
              ].map(({ id, icon: Icon, color, label, type }) => (
                <button
                  key={type} id={id}
                  onClick={() => {
                    setActionReason(''); setTempPassword('');
                    if (type === 'HISTORY') fetchHistory(actionRec);
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
                onClick={() => { closeAll(); openDelete(actionRec); }}
                className="w-full p-3 bg-rose-900/20 hover:bg-rose-900/40 rounded-xl font-bold text-rose-400 border border-rose-800/40 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── STATUS CHANGE MODAL ── */}
      {actionRec && actionType === 'STATUS' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Change Account Status">
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Current Status:</span>
              <StatusBadge status={(actionRec.isDeleted || actionRec.userId?.isDeleted) ? 'DELETED' : (actionRec.status || actionRec.userId?.status || 'ACTIVE')} />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Reason (Optional)</label>
              <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {getAvailableStatuses(actionRec.status || actionRec.userId?.status, actionRec.isDeleted || actionRec.userId?.isDeleted).map((s) => {
                const cfg = STATUS_LABELS[s]; const Icon = cfg.icon;
                return (
                  <button key={s} id={`status-btn-${s.toLowerCase()}`} onClick={() => requestStatusChange(s)}
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
      {actionRec && actionType === 'CONFIRM_STATUS' && pendingStatus && (
        <Modal isOpen={true} onClose={() => setActionType('STATUS')} title={`Confirm: ${STATUS_LABELS[pendingStatus]?.label}`}>
          <div className="space-y-4 text-xs">
            <div className={`p-4 rounded-xl border ${pendingStatus === 'SUSPENDED' ? 'bg-amber-900/20 border-amber-500/40' : pendingStatus === 'BLOCKED' ? 'bg-rose-900/20 border-rose-500/40' : 'bg-slate-800 border-slate-700'}`}>
              <p className="font-bold text-white mb-1">Confirm {STATUS_LABELS[pendingStatus]?.label.toLowerCase()} this account?</p>
              <p className="text-slate-400">Account: <strong className="text-white">{actionRec.email || actionRec.userId?.email}</strong></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionType('STATUS')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
              <button id={`confirm-status-${pendingStatus.toLowerCase()}`} onClick={() => handleUpdateStatus(pendingStatus)} disabled={actionLoading}
                className={`flex-1 py-2 rounded-xl font-bold text-white ${pendingStatus === 'SUSPENDED' ? 'bg-amber-600 hover:bg-amber-500' : pendingStatus === 'BLOCKED' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {actionLoading ? 'Processing...' : `${STATUS_LABELS[pendingStatus]?.label}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {actionRec && actionType === 'RESET' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Reset Recruiter Password">
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
                <p className="text-slate-300">A secure temporary password will be generated and the recruiter must change it on next login.</p>
                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl text-amber-400 text-[11px] font-semibold">⚠️ Existing password will be replaced immediately.</div>
                <div>
                  <label className="block text-slate-400 mb-1">Reason (Optional)</label>
                  <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setActionType('MANAGE')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
                  <button id="confirm-reset-password" onClick={handleResetPassword} disabled={actionLoading} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl">
                    {actionLoading ? 'Resetting...' : 'Generate Temp Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── FORCE PW CHANGE MODAL ── */}
      {actionRec && actionType === 'FORCE' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title="Force Password Change">
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">The recruiter will be required to set a new password on next login.</p>
            <div>
              <label className="block text-slate-400 mb-1">Reason (Optional)</label>
              <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white" placeholder="Reason..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionType('MANAGE')} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Cancel</button>
              <button id="confirm-force-password" onClick={handleForcePasswordChange} disabled={actionLoading} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded-xl">
                {actionLoading ? 'Applying...' : 'Force Password Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── AUDIT HISTORY MODAL ── */}
      {actionRec && actionType === 'HISTORY' && (
        <Modal isOpen={true} onClose={() => setActionType('MANAGE')} title={`Audit History: ${actionRec.email || actionRec.userId?.email}`} maxWidth="max-w-2xl">
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

      {/* ── ADMIN RATING MODAL ── */}
      {actionRec && actionType === 'RATING' && (
        <AdminRatingModal
          isOpen={true}
          onClose={() => setActionType(detailUser ? null : 'MANAGE')}
          targetUser={actionRec.userId || actionRec}
          targetProfile={actionRec.profile || actionRec}
          currentRating={actionRec.rating || actionRec.profile?.rating}
          initialRemoveMode={ratingModalMode === 'REMOVE'}
          onRatingUpdated={(newRating) => {
            // Update local state for immediate UI refresh
            setRecruiters((prev) => prev.map(r => r._id === actionRec._id ? { ...r, rating: newRating } : r));
            if (detailUser && (detailUser._id === actionRec._id || detailUser.userId?._id === actionRec.userId?._id)) {
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

export default AdminRecruiters;
