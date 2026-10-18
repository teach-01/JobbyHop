import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { ShieldCheck, XCircle, AlertTriangle, Briefcase, Calendar, Clock, MapPin, Users, IndianRupee, FileText } from 'lucide-react';

export const JobApprovalModal = ({ isOpen, onClose, job, onSubmitReview, isEventUpdate = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'Wedding',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    workersRequired: 1,
    adminApprovedPayment: 0,
    adminNotes: '',
    action: 'APPROVE',
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (job) {
      setErrorMessage(null);
      setFormData({
        title: job.title || '',
        description: job.description || '',
        eventType: job.eventType || 'Wedding',
        eventDate: job.eventDate ? job.eventDate.split('T')[0] : '',
        startTime: job.startTime || '',
        endTime: job.endTime || '',
        location: job.location || '',
        workersRequired: job.workersRequired || 1,
        adminApprovedPayment: job.adminApprovedPayment || job.recruiterProposedPayment || 0,
        adminNotes: job.adminNotes || '',
        action: isEventUpdate ? job.status : 'APPROVE',
      });
    }
  }, [job, isEventUpdate]);

  if (!job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.title?.trim()) {
      setErrorMessage('Event title is required.');
      return;
    }
    if (!formData.eventDate) {
      setErrorMessage('Event date is required.');
      return;
    }
    if (Number(formData.workersRequired) < 1) {
      setErrorMessage('At least 1 worker is required.');
      return;
    }
    if (Number(formData.adminApprovedPayment) < 0) {
      setErrorMessage('Payment cannot be negative.');
      return;
    }

    setSubmitting(true);
    const submissionData = {
      ...formData,
      action: isEventUpdate ? formData.action : 'APPROVE',
    };
    const res = await onSubmitReview(job._id, submissionData);
    if (res && res.success === false) {
      setErrorMessage(res.message || 'Error saving changes.');
    }
    setSubmitting(false);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!formData.adminNotes.trim()) {
      setErrorMessage('Please provide a rejection reason in the internal notes.');
      return;
    }
    setSubmitting(true);
    const rejectionData = {
      ...formData,
      action: 'REJECT',
    };
    const res = await onSubmitReview(job._id, rejectionData);
    if (res && res.success === false) {
      setErrorMessage(res.message || 'Error rejecting job.');
    }
    setSubmitting(false);
  };

  const getRecruiterName = (job) => job.recruiterProfile?.fullName || job.recruiterId?.email || 'Unknown Recruiter';
  const getRecruiterEmail = (job) => job.recruiterProfile?.email || job.recruiterId?.email || '';
  const getRecruiterPhone = (job) => job.recruiterProfile?.phone || job.recruiterId?.phone || '';
  const getCompanyName = (job) => job.recruiterProfile?.companyName || '';

  const modalTitle = isEventUpdate ? `Update Event: ${job.title}` : `Review Job Request: ${job.title}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs h-full max-h-[80vh] overflow-y-auto pr-2">
        {/* Error message alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Recruiter Details */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-brand-400" /> Recruiter Information
          </h4>
          <div className="grid grid-cols-2 gap-3 text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Name</span>
              <span className="font-semibold text-white">{getRecruiterName(job)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Email</span>
              <span>{getRecruiterEmail(job)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone</span>
              <span>{getRecruiterPhone(job)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Company</span>
              <span>{getCompanyName(job) || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* ── Payment Offer (Immutable Snapshot) ── */}
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-3">
          <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-amber-400" /> Recruiter's Payment Offer
          </h4>
          <p className="text-[10px] text-amber-200/60">
            This is the immutable offer recorded when the recruiter submitted the request.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-500/70 block text-[10px] uppercase font-bold mb-1">Per Person</span>
              <span className="font-extrabold text-amber-300 text-lg">
                {formatCurrency(job.offeredAmountPerPerson ?? job.recruiterProposedPayment)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-400/70 block text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Workers
              </span>
              <span className="font-extrabold text-purple-300 text-lg">{job.workersRequired}</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400/70 block text-[10px] uppercase font-bold mb-1">Total Offer</span>
              <span className="font-extrabold text-emerald-300 text-lg">
                {formatCurrency(
                  job.offeredTotalAmount ??
                  ((job.offeredAmountPerPerson ?? job.recruiterProposedPayment) * job.workersRequired)
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" /> Editable Event Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Job Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Event Type</label>
                <input
                  type="text"
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Event Date</label>
                <input
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Start Time</label>
                <input
                  type="text"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">End Time</label>
                <input
                  type="text"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Location</label>
              <input
                type="text"
                value={typeof formData.location === 'object' && formData.location !== null ? formData.location.address : (formData.location || '')}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  location: (typeof formData.location === 'object' && formData.location !== null)
                    ? { ...formData.location, address: e.target.value } 
                    : e.target.value 
                })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Workers Required</label>
                <input
                  type="number"
                  min="1"
                  value={formData.workersRequired}
                  onChange={(e) => setFormData({ ...formData, workersRequired: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-400 mb-1">Final Admin-Approved Payment (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.adminApprovedPayment}
                  onChange={(e) => setFormData({ ...formData, adminApprovedPayment: Number(e.target.value) })}
                  className="w-full bg-slate-900 border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-300 font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {isEventUpdate && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Event Status</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="APPROVED">Approved & Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Admin Internal Notes / Rejection Reason</label>
              <textarea
                rows="2"
                value={formData.adminNotes}
                onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                placeholder="Required if rejecting..."
              />
            </div>
        </div>

        {/* Action Decision Buttons */}
        {isEventUpdate ? (
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-950/80 p-3 rounded-xl backdrop-blur-md border border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="gradient-btn px-6 py-2 rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-950/80 p-3 rounded-xl backdrop-blur-md border border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Reject Job
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="gradient-btn px-6 py-2 rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" /> {submitting ? 'Processing...' : `Approve Job (₹${formData.adminApprovedPayment})`}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default JobApprovalModal;
