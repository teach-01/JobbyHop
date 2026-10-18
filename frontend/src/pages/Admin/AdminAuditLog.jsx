import React, { useState, useEffect, useCallback, useMemo } from 'react';
import auditService from '../../services/auditService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  History, Shield, Trash2, RotateCcw, AlertTriangle, Clock, User,
  ArrowRight, Flame, Search, Filter, Eye, IndianRupee, Briefcase,
  UserCheck, CreditCard, CalendarCheck, ChevronDown, X, Printer,
} from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';
import { exportDetailedRecordsToPdf, isRealUploadedImage } from '../../utils/printPdfExport';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { BulkCheckbox, BulkActionToolbar, BulkConfirmModal } from '../../components/admin/BulkActionComponents';
import bulkAdminService from '../../services/bulkAdminService';
import userService from '../../services/userService';
import DateFilter from '../../components/common/DateFilter';
import { DEFAULT_DATE_FILTER, matchesDateFilter } from '../../utils/dateFilterHelper';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(permanentDeleteAt) {
  if (!permanentDeleteAt) return null;
  const diff = new Date(permanentDeleteAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function Field({ label, value, accent }) {
  if (value == null || value === '' || value === undefined) return null;
  return (
    <div>
      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">{label}</span>
      <span className={`font-semibold ${accent || 'text-white'}`}>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, color = 'brand', children }) {
  const colorMap = {
    brand:   'text-brand-300 border-brand-500/30 bg-brand-500/5',
    emerald: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5',
    amber:   'text-amber-300 border-amber-500/30 bg-amber-500/5',
    purple:  'text-purple-300 border-purple-500/30 bg-purple-500/5',
    rose:    'text-rose-300 border-rose-500/30 bg-rose-500/5',
    slate:   'text-slate-300 border-slate-700 bg-slate-900/60',
  };
  return (
    <div className={`p-4 rounded-xl border space-y-3 ${colorMap[color]}`}>
      <h4 className={`font-bold text-sm flex items-center gap-2 ${colorMap[color].split(' ')[0]}`}>
        {Icon && <Icon className="w-4 h-4" />}
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3 text-xs">{children}</div>
    </div>
  );
}

// ── View Details Modal ────────────────────────────────────────────────────────

function AuditDetailModal({ log, onClose }) {
  if (!log) return null;
  const ed = log.entityData;

  const renderPrevNew = () => {
    // ACCOUNT_SELF_DELETED must NEVER show Change Record / Previous Value / New Value
    if (log.action === 'ACCOUNT_SELF_DELETED') return null;
    const pv = log.previousValue;
    const nv = log.newValue;
    if (pv == null && nv == null) return null;
    const fmt = (v) => (v != null && typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '—'));
    return (
      <Section title="Change Record" icon={ArrowRight} color="slate">
        <div className="col-span-2 flex items-start gap-3 text-xs">
          <div className="flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Previous Value</span>
            <pre className="text-rose-400 bg-slate-950 rounded-lg p-2 whitespace-pre-wrap break-all text-[11px] max-h-32 overflow-auto">
              {fmt(pv)}
            </pre>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 mt-6 shrink-0" />
          <div className="flex-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">New Value</span>
            <pre className="text-emerald-400 bg-slate-950 rounded-lg p-2 whitespace-pre-wrap break-all text-[11px] max-h-32 overflow-auto">
              {fmt(nv)}
            </pre>
          </div>
        </div>
      </Section>
    );
  };

  // ── Payment detail ─────────────────────────────────────────────────────────
  const renderPaymentDetail = () => {
    const pay = ed; // entityData IS the payment object
    const job = pay?.jobId;
    const workerProfile = pay?.workerProfile;
    const recruiterProfile = pay?.recruiterProfile;
    return (
      <div className="space-y-4 text-xs">
        {/* Worker info */}
        {(workerProfile || pay?.workerId) && (
          <Section title="Worker Information" icon={UserCheck} color="brand">
            <Field label="Full Name" value={workerProfile?.fullName} />
            <Field label="Email" value={workerProfile?.email || pay?.workerId?.email} />
            <Field label="Phone" value={workerProfile?.phone || pay?.workerId?.phone} />
            <Field label="Worker ID" value={pay?.workerId?._id?.toString() || pay?.workerId?.toString()} accent="text-slate-400 font-mono text-[10px]" />
            <Field label="Location" value={workerProfile?.location} />
            <Field label="Rating" value={workerProfile?.rating ? `${workerProfile.rating}/5` : null} />
          </Section>
        )}

        {/* Recruiter info */}
        {recruiterProfile && (
          <Section title="Recruiter Information" icon={Briefcase} color="purple">
            <Field label="Name" value={recruiterProfile?.fullName} />
            <Field label="Email" value={recruiterProfile?.email} />
            <Field label="Phone" value={recruiterProfile?.phone} />
            <Field label="Company" value={recruiterProfile?.companyName} />
          </Section>
        )}

        {/* Event / Job info */}
        {job && (
          <Section title="Event / Job" icon={CalendarCheck} color="amber">
            <Field label="Event Name" value={job?.title} accent="text-amber-300 font-bold" />
            <Field label="Event Type" value={job?.eventType} />
            <Field label="Event Date" value={job?.eventDate ? formatDate(job.eventDate) : null} />
            <Field label="Location" value={getLocationString(job?.location)} />
            <Field label="Recruiter Proposed" value={job?.recruiterProposedPayment ? formatCurrency(job.recruiterProposedPayment) : null} accent="text-amber-400 font-bold" />
            <Field label="Admin Approved" value={job?.adminApprovedPayment ? formatCurrency(job.adminApprovedPayment) : null} accent="text-emerald-400 font-bold" />
          </Section>
        )}

        {/* Payment details */}
        <Section title="Payment Details" icon={CreditCard} color="emerald">
          <Field label="Payment ID" value={pay?._id?.toString()} accent="text-slate-400 font-mono text-[10px]" />
          <Field label="Amount" value={pay?.amount != null ? formatCurrency(pay.amount) : null} accent="text-emerald-400 font-extrabold" />
          <Field label="Status" value={pay?.status} accent="text-brand-300 font-bold" />
          <Field label="Method" value={pay?.paymentMethod} />
          <Field label="Payout Target" value={pay?.expectedPaymentDate ? formatDate(pay.expectedPaymentDate) : null} />
          <Field label="Paid At" value={pay?.paidAt ? formatDateTime(pay.paidAt) : null} accent="text-emerald-400" />
          <Field label="Processed At" value={pay?.processedAt ? formatDateTime(pay.processedAt) : null} />
          <Field label="UTR / Ref" value={pay?.transactionRef || null} accent="text-purple-300 font-mono" />
          <Field label="Admin Notes" value={pay?.adminNotes || null} />
        </Section>

        {renderPrevNew()}
      </div>
    );
  };

  // ── Job detail ─────────────────────────────────────────────────────────────
  const renderJobDetail = () => {
    const job = ed;
    const recruiterProfile = job?.recruiterProfile;
    const recruiterUser = job?.recruiterId;
    const nv = log.newValue;
    return (
      <div className="space-y-4 text-xs">
        {/* Recruiter */}
        {(recruiterProfile || recruiterUser) && (
          <Section title="Recruiter Information" icon={Briefcase} color="purple">
            <Field label="Name" value={recruiterProfile?.fullName} />
            <Field label="Email" value={recruiterProfile?.email || recruiterUser?.email} />
            <Field label="Phone" value={recruiterProfile?.phone || recruiterUser?.phone} />
            <Field label="Company" value={recruiterProfile?.companyName} />
            <Field label="Recruiter ID" value={recruiterUser?._id?.toString()} accent="text-slate-400 font-mono text-[10px]" />
          </Section>
        )}

        {/* Job details */}
        <Section title="Job / Event Details" icon={CalendarCheck} color="amber">
          <Field label="Job ID" value={job?._id?.toString()} accent="text-slate-400 font-mono text-[10px]" />
          <Field label="Title" value={job?.title} accent="text-amber-300 font-bold" />
          <Field label="Event Type" value={job?.eventType} />
          <Field label="Event Date" value={job?.eventDate ? formatDate(job.eventDate) : null} />
          <Field label="Location" value={getLocationString(job?.location)} />
          <Field label="Workers Required" value={job?.workersRequired} />
          <div className="col-span-2 border-t border-slate-700 pt-2 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Recruiter Proposed" value={job?.recruiterProposedPayment ? formatCurrency(job.recruiterProposedPayment) : null} accent="text-amber-400 font-bold" />
              <Field label="Admin Approved Pay" value={job?.adminApprovedPayment ? formatCurrency(job.adminApprovedPayment) : null} accent="text-emerald-400 font-bold" />
              {nv?.offeredAmountPerPerson != null && (
                <Field label="Offered Per Person" value={formatCurrency(nv.offeredAmountPerPerson)} accent="text-amber-300" />
              )}
              {nv?.offeredTotalAmount != null && (
                <Field label="Offered Total" value={formatCurrency(nv.offeredTotalAmount)} accent="text-amber-300" />
              )}
            </div>
          </div>
          <Field label="Status" value={job?.status} accent="text-brand-300 font-bold" />
          {nv?.acceptedByAdminEmail && <Field label="Accepted By" value={nv.acceptedByAdminEmail} accent="text-emerald-400" />}
          {nv?.rejectionReason && <Field label="Rejection Reason" value={nv.rejectionReason} accent="text-rose-400" />}
        </Section>

        {renderPrevNew()}
      </div>
    );
  };

  // ── Account Self-Deleted Snapshot Card ──────────────────────────────────────
  const renderSelfDeletedDetail = () => {
    const snap = log.previousValue || {};
    const profileInfo = snap.profileInformation || {};
    const role = snap.role || snap.targetRole || snap.actorRole || 'WORKER';
    const isWorker = role === 'WORKER';
    const isRecruiter = role === 'RECRUITER';
    const fullName = snap.fullName || snap.targetFullName || profileInfo.fullName || snap.subjectName || log.subjectName || '—';
    const email = snap.email || snap.targetEmail || profileInfo.email || '—';
    const phone = snap.phone || snap.targetPhone || profileInfo.phone || '—';
    const location = snap.location || snap.targetLocation || profileInfo.location || '—';
    const userId = snap.userId || snap.targetUserId || snap.actorUserId || (log.entityId?._id || log.entityId)?.toString() || '—';
    const statusAtDeletion = snap.accountStatus || 'DEACTIVATED';
    const deletionAction = snap.actionType || snap.action || log.action || 'ACCOUNT_SELF_DELETED';
    const deletionTime = snap.deletionTimestamp || snap.timestamp || log.createdAt || log.timestamp;
    const profileImage = snap.profileImage || profileInfo.profilePhoto || profileInfo.companyLogo || null;
    const companyName = profileInfo.companyName || snap.companyName || null;

    return (
      <div className="space-y-4 text-xs">
        {/* Historical Account Snapshot Card */}
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 via-slate-900/90 to-slate-950 p-6 shadow-2xl relative overflow-hidden">
          {/* Top badge */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-rose-400">
                Account Self-Deleted
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Historical Snapshot
            </span>
          </div>

          {/* Profile Image & Header Prominently at Top */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3.5">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={fullName}
                  className="w-28 h-28 rounded-2xl object-cover ring-4 ring-rose-500/20 border-2 border-rose-500/40 shadow-2xl shadow-rose-950/60"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                style={{ display: profileImage ? 'none' : 'flex' }}
                className="w-28 h-28 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 ring-4 ring-rose-500/20 border-2 border-slate-700 items-center justify-center text-slate-300 font-extrabold text-3xl shadow-2xl shadow-slate-950/60"
              >
                {fullName && fullName !== '—' ? fullName.charAt(0).toUpperCase() : <User className="w-12 h-12 text-slate-500" />}
              </div>
            </div>

            <h3 className="text-xl font-extrabold text-white tracking-tight">{fullName}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isWorker
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              }`}>
                {role}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                Status: {statusAtDeletion}
              </span>
            </div>
          </div>

          {/* Snapshot Grid Details */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-4 space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-brand-400" /> Account Identity &amp; Lifecycle
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Full Name</span>
                <span className="text-white font-semibold text-sm">{fullName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Email</span>
                <span className="text-slate-300 font-mono">{email}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Phone</span>
                <span className="text-slate-300 font-mono">{phone}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Role</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isWorker ? 'bg-brand-500/10 text-brand-300 border border-brand-500/30' : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                }`}>
                  {role}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Location</span>
                <span className="text-slate-300">{location}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">User ID</span>
                <span className="text-slate-400 font-mono text-[11px] select-all break-all">{userId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Account Status at Deletion</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {statusAtDeletion}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Deletion Action</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {deletionAction}
                </span>
              </div>
              <div className="sm:col-span-2 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Deleted At</span>
                <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  {deletionTime ? formatDateTime(deletionTime) : '—'}
                </span>
              </div>
            </div>

            {/* Additional Historical Attributes Captured */}
            {(isWorker && (profileInfo.dob || (profileInfo.skills && profileInfo.skills.length > 0) || profileInfo.completedEventsCount != null || profileInfo.rating != null)) && (
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-brand-400" /> Historical Worker Data
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {profileInfo.dob && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Date of Birth</span>
                      <span className="text-slate-300">{formatDate(profileInfo.dob)}</span>
                    </div>
                  )}
                  {profileInfo.rating != null && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Historical Rating</span>
                      <span className="text-amber-400 font-semibold">★ {profileInfo.rating} / 5</span>
                    </div>
                  )}
                  {profileInfo.completedEventsCount != null && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Completed Events</span>
                      <span className="text-slate-300">{profileInfo.completedEventsCount}</span>
                    </div>
                  )}
                  {profileInfo.skills && profileInfo.skills.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Skills</span>
                      <div className="flex flex-wrap gap-1.5">
                        {profileInfo.skills.map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(isRecruiter && (companyName || profileInfo.companyDescription || profileInfo.businessExperience || profileInfo.totalJobsSubmitted != null || profileInfo.approvedJobsCount != null)) && (
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-purple-400" /> Historical Recruiter Data
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {companyName && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Company Name</span>
                      <span className="text-purple-300 font-semibold">{companyName}</span>
                    </div>
                  )}
                  {profileInfo.businessExperience && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Business Experience</span>
                      <span className="text-slate-300">{profileInfo.businessExperience}</span>
                    </div>
                  )}
                  {profileInfo.totalJobsSubmitted != null && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Total Jobs Submitted</span>
                      <span className="text-slate-300">{profileInfo.totalJobsSubmitted}</span>
                    </div>
                  )}
                  {profileInfo.approvedJobsCount != null && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Approved Jobs</span>
                      <span className="text-slate-300">{profileInfo.approvedJobsCount}</span>
                    </div>
                  )}
                  {profileInfo.companyDescription && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Company Description</span>
                      <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        {profileInfo.companyDescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    );
  };

  // ── User detail ────────────────────────────────────────────────────────────
  const renderUserDetail = () => {
    if (log.action === 'ACCOUNT_SELF_DELETED') {
      return renderSelfDeletedDetail();
    }
    const u = ed;
    const isWorker = u?.role === 'WORKER' || u?.workerProfile;
    const role = u?.role;
    const email = u?.email || (isWorker ? u?.workerProfile?.email : u?.recruiterProfile?.email);
    const phone = u?.phone || (isWorker ? u?.workerProfile?.phone : u?.recruiterProfile?.phone);
    const fullName = isWorker ? u?.workerProfile?.fullName : u?.recruiterProfile?.fullName;
    const userId = u?._id?.toString();
    const status = u?.status;
    const location = isWorker ? u?.workerProfile?.location : u?.recruiterProfile?.location;
    const company = u?.recruiterProfile?.companyName;

    return (
      <div className="space-y-4 text-xs">
        <Section title={isWorker ? 'Worker Account' : 'Recruiter Account'} icon={isWorker ? UserCheck : Briefcase} color={isWorker ? 'brand' : 'purple'}>
          <Field label="Full Name" value={fullName} accent="text-white font-bold" />
          <Field label="Email" value={email} />
          <Field label="Phone" value={phone} />
          <Field label="User ID" value={userId} accent="text-slate-400 font-mono text-[10px]" />
          <Field label="Role" value={role} accent="text-brand-300 font-bold" />
          <Field label="Account Status" value={status} />
          {isWorker ? (
            <>
              <Field label="Location" value={location} />
              <Field label="Rating" value={u?.workerProfile?.rating ? `${u.workerProfile.rating}/5` : null} />
              <Field label="Skills" value={u?.workerProfile?.skills?.length ? u.workerProfile.skills.join(', ') : null} />
              <Field label="Completed Events" value={u?.workerProfile?.completedEventsCount} />
            </>
          ) : (
            <>
              <Field label="Company" value={company} />
              <Field label="Location" value={location} />
              <Field label="Total Jobs" value={u?.recruiterProfile?.totalJobsSubmitted} />
              <Field label="Approved Jobs" value={u?.recruiterProfile?.approvedJobsCount} />
            </>
          )}
        </Section>
        {renderPrevNew()}
      </div>
    );
  };

  // ── Attendance detail ──────────────────────────────────────────────────────
  const renderAttendanceDetail = () => {
    const rec = ed;
    const workerProfile = rec?.workerProfile;
    const job = rec?.jobId;
    return (
      <div className="space-y-4 text-xs">
        {(workerProfile || rec?.workerId) && (
          <Section title="Worker Information" icon={UserCheck} color="brand">
            <Field label="Name" value={workerProfile?.fullName} />
            <Field label="Email" value={workerProfile?.email || rec?.workerId?.email} />
            <Field label="Phone" value={workerProfile?.phone} />
            <Field label="Worker ID" value={rec?.workerId?._id?.toString() || rec?.workerId?.toString()} accent="text-slate-400 font-mono text-[10px]" />
          </Section>
        )}
        {job && (
          <Section title="Event / Job" icon={CalendarCheck} color="amber">
            <Field label="Event Name" value={job?.title} accent="text-amber-300 font-bold" />
            <Field label="Event Type" value={job?.eventType} />
            <Field label="Event Date" value={job?.eventDate ? formatDate(job.eventDate) : null} />
            <Field label="Location" value={getLocationString(job?.location)} />
          </Section>
        )}
        <Section title="Attendance Record" icon={CalendarCheck} color="slate">
          <Field label="Record ID" value={rec?._id?.toString()} accent="text-slate-400 font-mono text-[10px]" />
          <Field label="Status" value={rec?.status} accent="text-brand-300 font-bold" />
          <Field label="Marked At" value={rec?.markedAt ? formatDateTime(rec.markedAt) : null} />
        </Section>
        {renderPrevNew()}
      </div>
    );
  };

  // ── Admin metadata (always shown at top) ──────────────────────────────────
  const renderAdminMeta = () => (
    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Performed By</span>
        <span className="text-white font-semibold">{log.performedByUserId?.email || 'System Admin'}</span>
        <span className="text-[10px] text-slate-500 block">{log.performedByRole}</span>
      </div>
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Action</span>
        <span className="text-brand-300 font-bold">{log.action}</span>
      </div>
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Timestamp</span>
        <span className="text-slate-300">{formatDateTime(log.createdAt || log.timestamp)}</span>
      </div>
      <div>
        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Entity</span>
        <span className="text-slate-400">{log.entityName} · <span className="font-mono text-[10px]">{log.entityId?.toString?.()?.slice(-8)}</span></span>
      </div>
      {log.notes && (
        <div className="col-span-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Notes</span>
          <p className="text-slate-300 leading-relaxed">{log.notes}</p>
        </div>
      )}
    </div>
  );

  const renderBody = () => {
    if (log.action === 'ACCOUNT_SELF_DELETED') {
      return renderSelfDeletedDetail();
    }
    switch (log.entityName) {
      case 'Payment':    return renderPaymentDetail();
      case 'Job':        return renderJobDetail();
      case 'User':       return renderUserDetail();
      case 'Attendance': return renderAttendanceDetail();
      default:           return renderPrevNew();
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Audit Detail — ${log.action}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {renderAdminMeta()}
        {renderBody()}
      </div>
    </Modal>
  );
}

// ── Shared row subject cell ───────────────────────────────────────────────────

function SubjectCell({ log }) {
  const name = log.subjectName;
  const role = log.subjectRole;

  // Primary: use the resolved subjectName + subjectRole from backend
  if (name) {
    const roleColor = role === 'WORKER' ? 'text-brand-300' : role === 'RECRUITER' ? 'text-purple-300' : 'text-slate-400';
    const nameColor = role === 'RECRUITER' ? 'text-purple-300' : 'text-white';

    // Try to show a secondary line (event/job title) for context
    const ed = log.entityData;
    let secondary = '';
    if (ed) {
      if (log.entityName === 'Payment' || log.entityName === 'Attendance' || log.entityName === 'Assignment' || log.entityName === 'Application') {
        secondary = ed.jobId?.title || '';
      } else if (log.entityName === 'Job') {
        secondary = ed.title || '';
      }
    }

    return (
      <div>
        <p className={`font-semibold ${nameColor}`}>{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${roleColor} bg-slate-800 border border-slate-700`}>
            {role}
          </span>
          {secondary && (
            <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{secondary}</span>
          )}
        </div>
      </div>
    );
  }

  // Fallback: no subject resolved
  return <span className="text-slate-500">—</span>;
}


// ── Active Logs Table ─────────────────────────────────────────────────────────

function ActiveLogsTable({ logs, onDelete, onViewDetails, bulk }) {
  if (!logs.length) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 glass-card rounded-2xl">
        No audit log history recorded yet.
      </div>
    );
  }
  return (
    <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 w-10">
                <BulkCheckbox
                  id="audit-select-all"
                  checked={bulk.isAllSelected}
                  indeterminate={bulk.isIndeterminate}
                  onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                />
              </th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User &amp; Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Worker / Recruiter</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {logs.map((log) => (
              <tr key={log._id} className={`hover:bg-slate-800/40 transition-colors ${bulk.isSelected(log._id) ? 'bg-brand-500/5' : ''}`}>
                <td className="px-4 py-3.5 w-10">
                  <BulkCheckbox
                    id={`audit-cb-${log._id}`}
                    checked={bulk.isSelected(log._id)}
                    onChange={() => bulk.toggleSelection(log._id)}
                  />
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-400" />
                    {formatDateTime(log.createdAt || log.timestamp)}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1 text-white font-medium">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    {log.performedByUserId?.email || 'System Admin'}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">{log.performedByRole}</span>
                </td>
                <td className="px-4 py-3.5 font-bold text-brand-300">{log.action}</td>
                <td className="px-4 py-3.5">
                  <SubjectCell log={log} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewDetails(log)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/30 hover:bg-brand-500/20 transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(log); }}
                      title="Move to Trash"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Trash Table ───────────────────────────────────────────────────────────────

function TrashTable({ logs, onRestore, onPermanentDelete, bulk }) {
  if (!logs.length) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 glass-card rounded-2xl">
        Trash is empty. No deleted audit logs.
      </div>
    );
  }
  return (
    <div className="glass-card rounded-2xl border border-rose-900/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 w-10">
                <BulkCheckbox
                  id="audit-trash-select-all"
                  checked={bulk.isAllSelected}
                  indeterminate={bulk.isIndeterminate}
                  onChange={() => bulk.isAllSelected ? bulk.clearSelection() : bulk.selectAll()}
                />
              </th>
              <th className="px-4 py-3">Original Timestamp</th>
              <th className="px-4 py-3">User &amp; Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Worker / Recruiter</th>
              <th className="px-4 py-3">Deleted</th>
              <th className="px-4 py-3">Perm. Delete</th>
              <th className="px-4 py-3">Days Left</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {logs.map((log) => {
              const days = daysRemaining(log.permanentDeleteAt);
              return (
                <tr key={log._id} className={`hover:bg-rose-950/10 transition-colors ${bulk.isSelected(log._id) ? 'bg-rose-500/10' : ''}`}>
                  <td className="px-4 py-3.5 w-10">
                    <BulkCheckbox
                      id={`audit-trash-cb-${log._id}`}
                      checked={bulk.isSelected(log._id)}
                      onChange={() => bulk.toggleSelection(log._id)}
                    />
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {formatDateTime(log.createdAt || log.timestamp)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">
                    <span className="flex items-center gap-1 text-white">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      {log.performedByUserId?.email || 'System Admin'}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">{log.performedByRole}</span>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-slate-400 line-through">{log.action}</td>
                  <td className="px-4 py-3.5"><SubjectCell log={log} /></td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-rose-400">
                    {log.deletedAt ? new Date(log.deletedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-orange-400">
                    {log.permanentDeleteAt ? new Date(log.permanentDeleteAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`font-bold ${days === 0 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-slate-400'}`}>
                      {days != null ? `${days}d` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onRestore(log)}
                        title="Restore"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      <button
                        onClick={() => onPermanentDelete(log)}
                        title="Delete Permanently"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                      >
                        <Flame className="w-3.5 h-3.5" /> Delete Forever
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ENTITY_OPTIONS = ['ALL', 'Payment', 'Job', 'User', 'Attendance'];

export const AdminAuditLog = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [activeLogs, setActiveLogs] = useState([]);
  const [trashLogs, setTrashLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search + filter
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState(DEFAULT_DATE_FILTER);

  // Modals
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, log: null });
  const [detailLog, setDetailLog] = useState(null);

  const [workersList, setWorkersList] = useState([]);
  const [recruitersList, setRecruitersList] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [activeRes, trashRes, workersRes, recruitersRes] = await Promise.all([
      auditService.getAuditLogs(),
      auditService.getTrashLogs(),
      userService.getWorkers(),
      userService.getRecruiters(),
    ]);
    if (activeRes.success) setActiveLogs(activeRes.data);
    if (trashRes.success) setTrashLogs(trashRes.data);
    if (workersRes?.success) setWorkersList(workersRes.data || []);
    if (recruitersRes?.success) setRecruitersList(recruitersRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // workerPhotoMap — keyed ONLY by MongoDB ID (never by name, to avoid
  // cross-role contamination when a recruiter and a worker share the same name).
  const workerPhotoMap = useMemo(() => {
    const map = new Map();
    for (const w of workersList) {
      const photo = w.profilePhoto || w.profile?.profilePhoto;
      if (!photo || !isRealUploadedImage(photo)) continue; // skip falsy / default photos
      // Key by _id (WorkerProfile doc ID)
      if (w._id) map.set(String(w._id).toLowerCase(), photo);
      // Key by userId._id (User doc ID)
      if (w.userId?._id) map.set(String(w.userId._id).toLowerCase(), photo);
      if (w.userId && typeof w.userId === 'string') map.set(w.userId.toLowerCase(), photo);
      // Key by email as secondary lookup (emails are globally unique)
      if (w.email) map.set(w.email.toLowerCase().trim(), photo);
      if (w.userId?.email) map.set(w.userId.email.toLowerCase().trim(), photo);
      // NOTE: DO NOT key by fullName — names are NOT unique and can cross
      //       between roles (e.g. a recruiter and a worker with the same name).
    }
    return map;
  }, [workersList]);

  // recruiterLogoMap — keyed ONLY by MongoDB ID.
  const recruiterLogoMap = useMemo(() => {
    const map = new Map();
    for (const r of recruitersList) {
      const logo = r.companyLogo || r.profile?.companyLogo;
      if (!logo || !isRealUploadedImage(logo)) continue; // skip empty / default logos
      if (r._id) map.set(String(r._id).toLowerCase(), logo);
      if (r.userId?._id) map.set(String(r.userId._id).toLowerCase(), logo);
      if (r.userId && typeof r.userId === 'string') map.set(r.userId.toLowerCase(), logo);
      if (r.email) map.set(r.email.toLowerCase().trim(), logo);
      if (r.userId?.email) map.set(r.userId.email.toLowerCase().trim(), logo);
    }
    return map;
  }, [recruitersList]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMoveToTrash = (log) => setConfirmModal({ open: true, type: 'trash-confirm', log });
  const handleRestore = (log) => setConfirmModal({ open: true, type: 'restore-confirm', log });
  const handlePermanentDelete = (log) => setConfirmModal({ open: true, type: 'perm-delete-confirm', log });
  const closeConfirm = () => setConfirmModal({ open: false, type: null, log: null });

  const confirmAction = async () => {
    if (!confirmModal.log) return;
    setActionLoading(true);
    let res;
    if (confirmModal.type === 'trash-confirm') res = await auditService.softDelete(confirmModal.log._id);
    else if (confirmModal.type === 'restore-confirm') res = await auditService.restore(confirmModal.log._id);
    else if (confirmModal.type === 'perm-delete-confirm') res = await auditService.permanentDelete(confirmModal.log._id);

    setActionLoading(false);
    closeConfirm();
    if (res?.success) {
      await fetchAll();
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // ── Client-side search + entity filter ───────────────────────────────────

  const applyFilters = (logs) => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      // Date filter
      if (!matchesDateFilter(log.createdAt || log.timestamp, dateFilter)) return false;
      // Entity type filter
      if (entityFilter !== 'ALL' && log.entityName !== entityFilter) return false;
      // Search
      if (q) {
        const adminEmail = (log.performedByUserId?.email || '').toLowerCase();
        const action = log.action.toLowerCase();
        const notes = (log.notes || '').toLowerCase();
        const entityName = log.entityName.toLowerCase();

        // Subject fields
        const ed = log.entityData;
        let subjectText = '';
        if (ed) {
          const wp = ed.workerProfile;
          const rp = ed.recruiterProfile;
          subjectText = [
            wp?.fullName, wp?.email, wp?.phone,
            rp?.fullName, rp?.email, rp?.companyName,
            ed.email, ed.title, ed.jobId?.title,
          ].filter(Boolean).join(' ').toLowerCase();
        }

        const searchable = `${adminEmail} ${action} ${notes} ${entityName} ${subjectText} ${(log.subjectName || '').toLowerCase()}`;
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  };

  const visibleActiveLogs = useMemo(() => applyFilters(activeLogs), [activeLogs, searchQuery, entityFilter, dateFilter]);
  const visibleTrashLogs  = useMemo(() => applyFilters(trashLogs),  [trashLogs,  searchQuery, entityFilter, dateFilter]);

  // Bulk Selection hooks
  const bulkActive = useBulkSelection(visibleActiveLogs);
  const bulkTrash = useBulkSelection(visibleTrashLogs);
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
      res = await bulkAdminService.bulkDeleteAuditLogs(ids);
    } else if (bulkConfirm.action === 'restore') {
      res = await bulkAdminService.bulkRestoreAuditLogs(ids);
    } else if (bulkConfirm.action === 'permanent') {
      res = await bulkAdminService.bulkPermanentDeleteAuditLogs(ids);
    }
    setBulkLoading(false);
    setBulkConfirm(null);
    if (res?.success) {
      if (isTrash) bulkTrash.clearSelection();
      else bulkActive.clearSelection();
      await fetchAll();
    }
  };

  // Resolve real uploaded profile image for an Audit Log record.
  // RULE: Workers → workerPhotoMap only. Recruiters → recruiterLogoMap only.
  // NEVER match by name. NEVER use a fallback/default image.
  const resolveAuditProfileImage = (l) => {
    // Determine the subject role (the person the action was performed ON).
    const subjectRole = (l.subjectRole || '').toUpperCase();
    const performerRole = (l.performedByRole || '').toUpperCase();

    // Helper: look up photo from the correct map using only ID-based keys.
    const lookupWorker = (idCandidates) => {
      for (const key of idCandidates) {
        if (!key) continue;
        const k = String(key).toLowerCase().trim();
        if (workerPhotoMap.has(k)) return workerPhotoMap.get(k);
      }
      return null;
    };
    const lookupRecruiter = (idCandidates) => {
      for (const key of idCandidates) {
        if (!key) continue;
        const k = String(key).toLowerCase().trim();
        if (recruiterLogoMap.has(k)) return recruiterLogoMap.get(k);
      }
      return null;
    };

    // Candidate ID set for the SUBJECT (person the action was performed on)
    const subjectIdCandidates = [
      l.subjectId,
      l.entityId?._id || l.entityId,
    ];

    // Candidate ID set for the PERFORMER
    const performerIdCandidates = [
      l.performedByUserId?._id || l.performedByUserId,
      l.performedByUserId?.email,
    ];

    // ── 1. Backend-enriched profileImage (already role-resolved by the server)
    if (l.profileImage && isRealUploadedImage(l.profileImage)) {
      return l.profileImage;
    }

    // ── 2. From enriched entityData — strictly role-separated
    if (l.entityData) {
      // Worker entity types: Payment, Attendance, Assignment, Application
      const isWorkerEntity = ['Payment', 'Attendance', 'Assignment', 'Application'].includes(l.entityName);
      // Recruiter entity types: Job
      const isRecruiterEntity = l.entityName === 'Job';

      if (isWorkerEntity && l.entityData.workerProfile?.profilePhoto) {
        const p = l.entityData.workerProfile.profilePhoto;
        if (isRealUploadedImage(p)) return p;
      }
      if (isRecruiterEntity && l.entityData.recruiterProfile?.companyLogo) {
        const p = l.entityData.recruiterProfile.companyLogo;
        if (isRealUploadedImage(p)) return p;
      }
      // For User entity: check actual subject role
      if (l.entityName === 'User') {
        if (subjectRole === 'WORKER' && l.entityData.workerProfile?.profilePhoto) {
          const p = l.entityData.workerProfile.profilePhoto;
          if (isRealUploadedImage(p)) return p;
        }
        if (subjectRole === 'RECRUITER' && l.entityData.recruiterProfile?.companyLogo) {
          const p = l.entityData.recruiterProfile.companyLogo;
          if (isRealUploadedImage(p)) return p;
        }
      }
      if (l.entityName === 'CancellationRequest') {
        if (subjectRole === 'WORKER' && l.entityData.workerProfile?.profilePhoto) {
          const p = l.entityData.workerProfile.profilePhoto;
          if (isRealUploadedImage(p)) return p;
        }
        if (subjectRole === 'RECRUITER' && l.entityData.recruiterProfile?.companyLogo) {
          const p = l.entityData.recruiterProfile.companyLogo;
          if (isRealUploadedImage(p)) return p;
        }
      }
    }

    // ── 3. From historical snapshot (ACCOUNT_SELF_DELETED / USER_DELETED)
    if (l.previousValue) {
      const snapshotPhoto =
        l.previousValue.profileInformation?.profilePhoto ||
        l.previousValue.profileImage ||
        null;
      const snapshotLogo =
        l.previousValue.profileInformation?.companyLogo ||
        l.previousValue.companyLogo ||
        null;

      if (subjectRole === 'WORKER' || subjectRole === '') {
        if (snapshotPhoto && isRealUploadedImage(snapshotPhoto)) return snapshotPhoto;
      }
      if (subjectRole === 'RECRUITER') {
        if (snapshotLogo && isRealUploadedImage(snapshotLogo)) return snapshotLogo;
      }
      // Ambiguous role — try photo then logo
      if (snapshotPhoto && isRealUploadedImage(snapshotPhoto)) return snapshotPhoto;
      if (snapshotLogo && isRealUploadedImage(snapshotLogo)) return snapshotLogo;
    }

    // ── 4. Live map lookup — strictly role-separated, ID-based only (no names)
    if (subjectRole === 'WORKER') {
      const p = lookupWorker(subjectIdCandidates);
      if (p) return p;
    } else if (subjectRole === 'RECRUITER') {
      const p = lookupRecruiter([...subjectIdCandidates, l.subjectEmail]);
      if (p) return p;
    }

    // Performer photo (only if no subject photo found)
    if (performerRole === 'WORKER') {
      const p = lookupWorker(performerIdCandidates);
      if (p) return p;
    } else if (performerRole === 'RECRUITER') {
      const p = lookupRecruiter(performerIdCandidates);
      if (p) return p;
    }

    // ── 5. No real image found — return null (no default/fallback)
    return null;
  };

  // Print / Save PDF export
  const handleExportPdf = (isTrash = false) => {
    const list = isTrash ? visibleTrashLogs : visibleActiveLogs;
    const bulkObj = isTrash ? bulkTrash : bulkActive;
    const selected = list.filter((l) => bulkObj.isSelected(l._id));
    if (selected.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanSectionName = isTrash ? 'Audit_History_Trash' : 'Audit_History';
    exportDetailedRecordsToPdf({
      title: isTrash ? 'Audit History (Trash)' : 'Audit History',
      subtitle: isTrash ? `Deleted Audit Trail Archive — ${dateStr}` : `Entity Filter: ${entityFilter} — ${dateStr}`,
      filename: `JobbyHop_${cleanSectionName}_${dateStr}.pdf`,
      records: selected,
      buildCard: (l) => {
        const photo = resolveAuditProfileImage(l);
        const hasSubject = Boolean(l.subjectName || l.subjectEmail || l.subjectId);
        const subjectPhoto = hasSubject ? photo : null;
        const performerPhoto = (!hasSubject && (l.performedByRole === 'WORKER' || l.performedByRole === 'RECRUITER')) ? photo : null;

        return [
          {
            heading: 'Audit Event',
            color: '#8b5cf6',
            rows: [
              ['Timestamp',   formatDateTime(l.createdAt || l.timestamp)],
              ['Action',      l.action],
              ['Entity Type', l.entityName],
              ['Entity ID',   l.entityId],
              ['Record ID',   l._id],
            ],
          },
          {
            heading: 'Performed By',
            color: '#06b6d4',
            photo: performerPhoto,
            rows: [
              ['Admin / Performer', l.performedByUserId?.fullName || l.performedByUserId?.name || l.performedByUserId?.email || 'System Admin'],
              ['Role',             l.performedByRole],
              ['User ID',          l.performedByUserId?._id || l.performedByUserId],
            ],
          },
          {
            heading: 'Subject / Affected Record',
            color: '#10b981',
            photo: subjectPhoto,
            rows: [
              ['Subject Name',  l.subjectName],
              ['Subject Role',  l.subjectRole],
              ['Subject Email', l.subjectEmail],
              ['Subject ID',    l.subjectId],
            ],
          },
          {
            heading: 'Change Details',
            color: '#f59e0b',
            rows: [
              ['Notes / Reason',  l.notes],
              ['Old Value',       l.oldValue != null ? String(l.oldValue) : null],
              ['New Value',       l.newValue != null ? String(l.newValue) : null],
              ['IP Address',      l.ipAddress],
              ['User Agent',      l.userAgent],
            ],
          },
          ...(isTrash ? [{
            heading: 'Trash Information',
            color: '#ef4444',
            rows: [
              ['Deleted At',     formatDate(l.deletedAt)],
              ['Auto-Delete At', formatDate(l.permanentDeleteAt)],
            ],
          }] : []),
        ];
      },
    });
  };

  const isFiltered = searchQuery.trim() !== '' || entityFilter !== 'ALL' || dateFilter.preset !== 'all';

  if (loading) return <LoadingSpinner label="Loading audit history trail..." />;

  // ── Confirm modal configs ─────────────────────────────────────────────────
  const confirmConfigs = {
    'trash-confirm': {
      title: 'Move to Trash?',
      body: (
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">This audit log will be moved to <span className="font-bold text-rose-400">Trash</span>.</p>
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
            <p className="font-semibold text-white mb-1">{confirmModal.log?.action} — {confirmModal.log?.entityName}</p>
            <p>{confirmModal.log?.notes || 'No notes.'}</p>
          </div>
          <p className="text-xs text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This record will remain in Trash for <strong>30 days</strong> before permanent deletion.
          </p>
        </div>
      ),
      confirmLabel: 'Move to Trash',
      confirmClass: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    'restore-confirm': {
      title: 'Restore Audit Log?',
      body: (
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">This audit log will be <span className="font-bold text-emerald-400">restored</span> to active history.</p>
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
            <p className="font-semibold text-white mb-1">{confirmModal.log?.action} — {confirmModal.log?.entityName}</p>
            <p>{confirmModal.log?.notes || 'No notes.'}</p>
          </div>
        </div>
      ),
      confirmLabel: 'Restore',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
    'perm-delete-confirm': {
      title: 'Delete Permanently?',
      body: (
        <div className="space-y-3 text-sm">
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300 mb-1">This action cannot be undone.</p>
              <p className="text-xs text-rose-300/80">The audit log will be permanently deleted from the database.</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
            <p className="font-semibold text-white mb-1">{confirmModal.log?.action} — {confirmModal.log?.entityName}</p>
            <p>{confirmModal.log?.notes || 'No notes.'}</p>
          </div>
        </div>
      ),
      confirmLabel: 'Delete Permanently',
      confirmClass: 'bg-rose-700 hover:bg-rose-600 text-white',
    },
  };

  const currentConfirm = confirmModal.type ? confirmConfigs[confirmModal.type] : null;

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-extrabold text-white">System Audit Log History</h1>
          </div>
          <p className="text-slate-400 mt-1">
            Audit history of job edits, payment rate changes, and admin decisions.
            Deleted records are retained in Trash for 30 days.
          </p>
        </div>
      </div>

      {/* Compliance callout */}
      <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-200 flex items-start gap-3">
        <Shield className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-brand-300">Audit Compliance Feature:</p>
          <p className="text-[11px] text-brand-300/80 mt-0.5">
            Every rate modification, approval decision, and status update is logged with timestamp, previous value,
            new value, and admin identity. Click <strong>View Details</strong> on any row for the full context.
          </p>
        </div>
      </div>

      {/* Search + Filter Toolbar */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, admin, worker, event, notes..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Entity type filter */}
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-all cursor-pointer"
            >
              <option value="ALL">All Types</option>
              {ENTITY_OPTIONS.filter(o => o !== 'ALL').map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>

          {/* Date filter */}
          <DateFilter dateFilter={dateFilter} onDateFilterChange={setDateFilter} />

          {/* Clear */}
          {isFiltered && (
            <button
              onClick={() => { setSearchQuery(''); setEntityFilter('ALL'); setDateFilter(DEFAULT_DATE_FILTER); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-0">
        <button
          onClick={() => handleTabChange('active')}
          className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === 'active'
              ? 'bg-slate-800 text-white border border-b-slate-800 border-slate-700'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Active Logs ({isFiltered ? `${visibleActiveLogs.length}/` : ''}{activeLogs.length})
        </button>
        <button
          onClick={() => handleTabChange('trash')}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === 'trash'
              ? 'bg-rose-950/50 text-rose-300 border border-b-rose-950/50 border-rose-900/60'
              : 'text-slate-500 hover:text-rose-400'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" /> Trash ({isFiltered ? `${visibleTrashLogs.length}/` : ''}{trashLogs.length})
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'active' ? (
        <>
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
                  desc: `Move ${bulkActive.selectedCount} audit log(s) to trash?`,
                  isDanger: false,
                }),
                variant: 'danger',
              },
            ]}
          />
          <ActiveLogsTable logs={visibleActiveLogs} onDelete={handleMoveToTrash} onViewDetails={setDetailLog} bulk={bulkActive} />
        </>
      ) : (
        <>
          {trashLogs.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Deleted records are automatically and permanently removed 30 days after deletion.
            </div>
          )}
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
                icon: RotateCcw,
                onClick: () => setBulkConfirm({
                  target: 'trash',
                  action: 'restore',
                  label: 'Restore',
                  desc: `Restore ${bulkTrash.selectedCount} audit log(s) from trash?`,
                  isDanger: false,
                }),
              },
              {
                label: 'Permanently Delete Selected',
                icon: Flame,
                onClick: () => setBulkConfirm({
                  target: 'trash',
                  action: 'permanent',
                  label: 'Permanently Delete',
                  desc: `Permanently delete ${bulkTrash.selectedCount} audit log(s)? This cannot be undone.`,
                  isDanger: true,
                }),
                variant: 'danger',
              },
            ]}
          />
          <TrashTable logs={visibleTrashLogs} onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} bulk={bulkTrash} />
        </>
      )}

      {/* View Details Modal */}
      {detailLog && <AuditDetailModal log={detailLog} onClose={() => setDetailLog(null)} />}

      {/* Confirmation Modal */}
      <Modal isOpen={confirmModal.open} onClose={closeConfirm} title={currentConfirm?.title || ''} maxWidth="max-w-md">
        <div className="space-y-5">
          {currentConfirm?.body}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeConfirm(); }}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmAction(); }}
              disabled={actionLoading}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-colors ${currentConfirm?.confirmClass} disabled:opacity-50`}
            >
              {actionLoading ? 'Processing…' : currentConfirm?.confirmLabel}
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

export default AdminAuditLog;
