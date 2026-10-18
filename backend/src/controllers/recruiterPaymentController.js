const RecruiterPayment = require('../models/RecruiterPayment');
const Job = require('../models/Job');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const { createNotification } = require('../services/notificationService');
const { logAuditEvent } = require('../services/auditService');
const { JOB_STATUS, ROLES } = require('../config/constants');
const mongoose = require('mongoose');
const { calculateAttendancePayable } = require('../utils/paymentCalculator');

// Helper: validate array of MongoDB ObjectIds
function validateIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  return ids.every((id) => mongoose.isValidObjectId(id));
}

/**
 * Helper: ensure an approved Job has a corresponding RecruiterPayment record.
 * Uses verified PRESENT attendance calculation for pre-submission PENDING payments.
 * Submitted (PROCESSING/COMPLETED/PAID) payment amounts are locked and strictly preserved.
 */
const ensurePaymentForJob = async (job) => {
  if (job.recruiterCollectionPermanentlyDeleted) {
    return null;
  }
  let payment = await RecruiterPayment.findOne({ jobId: job._id });
  const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(job._id);

  const fallbackAmount = Number(
    job.recruiterPaymentAmount ||
    job.offeredTotalAmount ||
    ((job.offeredAmountPerPerson || job.recruiterProposedPayment || 0) * (job.workersRequired || 1))
  );
  const targetAmount = eligibleCount > 0 ? totalPayable : fallbackAmount;
  const targetRate = perPersonRate || Number(job.offeredAmountPerPerson || job.recruiterProposedPayment || 0);

  if (!payment) {
    payment = await RecruiterPayment.create({
      recruiterId: job.recruiterId,
      jobId: job._id,
      amount: targetAmount,
      perPersonRate: targetRate,
      verifiedAttendeesCount: eligibleCount,
      status: 'PENDING',
    });
    job.recruiterPaymentAmount = targetAmount;
    job.recruiterPaymentStatus = 'PENDING';
    await job.save();
  } else if (!payment.isDeleted && payment.status === 'PENDING') {
    // Only refresh amount for PENDING payments (pre-submission)
    // Preserves existing submitted/paid amounts permanently
    let changed = false;
    if (payment.amount !== targetAmount || payment.verifiedAttendeesCount !== eligibleCount || payment.perPersonRate !== targetRate) {
      payment.amount = targetAmount;
      payment.verifiedAttendeesCount = eligibleCount;
      payment.perPersonRate = targetRate;
      changed = true;
    }
    if (changed) {
      await payment.save();
    }
    if (job.recruiterPaymentAmount !== targetAmount) {
      job.recruiterPaymentAmount = targetAmount;
      await job.save();
    }
  }
  return payment;
};

// ── GET MY PAYMENTS (Recruiter) ──────────────────────────────────────────────
exports.getMyPayments = async (req, res, next) => {
  try {
    const recruiterUserId = req.user._id;

    // Automatically sync any approved/completed jobs for this recruiter
    // Recruiter payment obligations sync for all approved/completed jobs even if Admin archived the job in Admin trash
    const approvedJobs = await Job.find({
      recruiterId: { $in: [recruiterUserId, recruiterUserId.toString()] },
      status: { $in: [JOB_STATUS.APPROVED, JOB_STATUS.COMPLETED] },
      recruiterCollectionPermanentlyDeleted: { $ne: true },
    });

    for (const job of approvedJobs) {
      await ensurePaymentForJob(job);
    }

    // IMPORTANT: Recruiters see ALL their payment records regardless of isDeleted.
    // isDeleted is an Admin-only administrative lifecycle flag.
    const payments = await RecruiterPayment.find({
      recruiterId: { $in: [recruiterUserId, recruiterUserId.toString()] },
    })
      .populate('jobId', 'title description eventType eventDate startTime endTime location workersRequired recruiterRequestedRate offeredAmountPerPerson recruiterProposedPayment')
      .sort({ createdAt: -1 });

    let pendingAmount = 0;
    let processingAmount = 0;
    let completedAmount = 0;
    let paidAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let paidCount = 0;
    let rejectedCount = 0;

    for (const p of payments) {
      switch (p.status) {
        case 'COMPLETED':
          completedAmount += p.amount;
          completedCount += 1;
          break;
        case 'PAID':
          paidAmount += p.amount;
          paidCount += 1;
          break;
        case 'PROCESSING':
          processingAmount += p.amount;
          processingCount += 1;
          break;
        case 'REJECTED':
          rejectedAmount += p.amount;
          rejectedCount += 1;
          break;
        default:
          pendingAmount += p.amount;
          pendingCount += 1;
      }
    }

    const summary = {
      totalAmount: pendingAmount + processingAmount + completedAmount + paidAmount,
      pendingAmount,
      processingAmount,
      completedAmount,
      paidAmount,
      rejectedAmount,
      totalCount: payments.length,
      pendingCount,
      processingCount,
      completedCount,
      paidCount,
      rejectedCount,
    };

    const sanitizedPayments = payments.map((p) => {
      const obj = p.toObject ? p.toObject() : { ...p };
      const job = obj.jobId || {};
      const rate = obj.perPersonRate ?? (typeof job === 'object' && job !== null ? (job.offeredAmountPerPerson ?? job.recruiterProposedPayment ?? job.recruiterRequestedRate) : null) ?? 0;
      obj.perPersonRate = rate;
      if (typeof job === 'object' && job !== null) {
        job.recruiterRequestedRate = rate;
        delete job.adminApprovedPayment;
        delete job.finalWorkerPayout;
        delete job.hasAdminApprovedRate;
        delete job.offeredAmountPerPerson;
        delete job.recruiterProposedPayment;
      }
      return obj;
    });

    res.json({
      success: true,
      payments: sanitizedPayments,
      data: sanitizedPayments,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

// ── SUBMIT PAYMENT (Recruiter pays Admin) ────────────────────────────────────
exports.submitPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { utr, utrNumber, paymentMethod, paymentProof, notes } = req.body;

    const utrVal = (utr || utrNumber || '').trim();

    // 1. Validate UTR / Transaction Number
    if (!utrVal || utrVal.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'UTR / Transaction Number is required.',
      });
    }

    if (utrVal.length < 6 || utrVal.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'UTR / Transaction Number must be between 6 and 50 characters.',
      });
    }

    // 2. Fetch payment record
    const payment = await RecruiterPayment.findById(id).populate('jobId');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter payment record not found.',
      });
    }

    // 3. Authorization check: recruiter can only pay for their own records
    if (payment.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit payment for this record.',
      });
    }

    // 4. Duplicate payment check: already submitted or fully verified
    if (payment.status === 'COMPLETED' || payment.status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'This payment has already been completed and is under review.',
      });
    }

    // 5. Backend calculation validation: compute latest eligible attendance & rate or fallback to offer
    const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(payment.jobId._id || payment.jobId);
    const job = payment.jobId;
    const fallbackAmount = Number(
      job?.recruiterPaymentAmount ||
      job?.offeredTotalAmount ||
      ((job?.offeredAmountPerPerson || job?.recruiterProposedPayment || 0) * (job?.workersRequired || 1))
    );
    const finalAmount = eligibleCount > 0 ? totalPayable : (payment.amount || fallbackAmount);
    const finalRate = perPersonRate || Number(job?.offeredAmountPerPerson || job?.recruiterProposedPayment || 0);

    if (finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit payment: Payment amount must be greater than zero.',
      });
    }

    // 6. Prevent duplicate UTR across already-confirmed records
    const existingUtr = await RecruiterPayment.findOne({
      _id: { $ne: payment._id },
      utr: utrVal,
      status: { $in: ['COMPLETED', 'PAID'] },
    });
    if (existingUtr) {
      return res.status(400).json({
        success: false,
        message: 'This UTR / Transaction Number has already been submitted for another confirmed payment.',
      });
    }

    // 7. Lock payment amount & verifiedAttendeesCount, update status → COMPLETED
    const previousStatus = payment.status;
    payment.amount = finalAmount;
    payment.perPersonRate = finalRate;
    payment.verifiedAttendeesCount = eligibleCount;
    payment.status = 'COMPLETED';
    payment.utr = utrVal;
    payment.paymentMethod = paymentMethod && ['UPI', 'Bank Transfer', 'Other'].includes(paymentMethod)
      ? paymentMethod
      : 'UPI';
    payment.paymentDate = new Date();
    if (paymentProof) payment.paymentProof = paymentProof;
    if (notes) payment.notes = notes;
    await payment.save();

    // 8. Sync Job status & locked amount
    if (job) {
      await Job.findByIdAndUpdate(job._id || job, {
        recruiterPaymentAmount: finalAmount,
        recruiterPaymentStatus: 'COMPLETED',
      });
    }

    // 9. Fetch recruiter profile for notification and audit log
    const recruiterProfile = await RecruiterProfile.findOne({ userId: req.user._id });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || req.user.email || 'Recruiter';
    const jobTitle = job?.title || 'Event';

    // 10. Audit Log
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.RECRUITER,
      action: 'RECRUITER_PAYMENT_COMPLETED',
      entityName: 'RecruiterPayment',
      entityId: payment._id,
      previousValue: { status: previousStatus },
      newValue: {
        status: payment.status,
        amount: payment.amount,
        utr: payment.utr,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate,
        jobId: job?._id || job,
        jobTitle,
      },
      notes: `Recruiter submitted payment of ₹${payment.amount} for event '${jobTitle}'. UTR: ${payment.utr}, Method: ${payment.paymentMethod}. Awaiting Admin verification.`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    // 11. Create Admin Notifications
    const admins = await User.find({ role: ROLES.ADMIN });
    for (const admin of admins) {
      await createNotification({
        userId: admin._id,
        title: 'Recruiter payment received – verify UTR',
        message: `${recruiterName} submitted a payment of ₹${payment.amount.toLocaleString('en-IN')} for "${jobTitle}". UTR: ${payment.utr}. Please verify and mark as PAID.`,
        type: 'RECRUITER_PAYMENT_RECEIVED',
        link: '/admin/recruiter-collections',
        relatedEntityType: 'RecruiterPayment',
        relatedEntityId: payment._id,
      });
    }

    // 12. Create Recruiter Confirmation Notification
    await createNotification({
      userId: req.user._id,
      title: 'Payment Submitted – Awaiting Admin Verification',
      message: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for '${jobTitle}' has been submitted (UTR: ${payment.utr}). Status: In Review.`,
      type: 'PAYMENT_SUBMITTED',
      link: '/recruiter/dashboard',
      relatedEntityType: 'RecruiterPayment',
      relatedEntityId: payment._id,
    });

    res.json({
      success: true,
      message: 'Payment details submitted successfully. Status is now Processing — awaiting Admin verification.',
      payment,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET SINGLE PAYMENT DETAILS ──────────────────────────────────────────────
exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await RecruiterPayment.findById(id)
      .populate('jobId', 'title description eventType eventDate startTime endTime location workersRequired recruiterRequestedRate offeredAmountPerPerson recruiterProposedPayment')
      .populate('recruiterId', 'email phone');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      });
    }

    // Role check: recruiter can only view own; admin can view any
    if (
      req.user.role === ROLES.RECRUITER &&
      payment.recruiterId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this payment record.',
      });
    }

    if (payment.status === 'PENDING') {
      const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(payment.jobId._id || payment.jobId);
      if (payment.amount !== totalPayable || payment.verifiedAttendeesCount !== eligibleCount || payment.perPersonRate !== perPersonRate) {
        payment.amount = totalPayable;
        payment.verifiedAttendeesCount = eligibleCount;
        payment.perPersonRate = perPersonRate;
        await payment.save();
      }
    }

    const recruiterProfile = await RecruiterProfile.findOne({ userId: payment.recruiterId._id });

    const paymentObj = payment.toObject ? payment.toObject() : { ...payment };
    const job = paymentObj.jobId || {};
    const rate = paymentObj.perPersonRate ?? (typeof job === 'object' && job !== null ? (job.offeredAmountPerPerson ?? job.recruiterProposedPayment ?? job.recruiterRequestedRate) : null) ?? 0;
    paymentObj.perPersonRate = rate;
    if (typeof job === 'object' && job !== null) {
      job.recruiterRequestedRate = rate;
      delete job.adminApprovedPayment;
      delete job.finalWorkerPayout;
      delete job.hasAdminApprovedRate;
      delete job.offeredAmountPerPerson;
      delete job.recruiterProposedPayment;
    }

    res.json({
      success: true,
      payment: paymentObj,
      data: paymentObj,
      collection: paymentObj, // Alias
      recruiterProfile,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET ALL RECRUITER PAYMENTS (Admin View) ──────────────────────────────────
exports.getAllRecruiterPayments = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    // Sync any approved jobs in system that lack a RecruiterPayment
    const allApprovedJobs = await Job.find({
      status: { $in: [JOB_STATUS.APPROVED, JOB_STATUS.COMPLETED] },
      isDeleted: { $ne: true },
      recruiterCollectionPermanentlyDeleted: { $ne: true },
    });
    for (const job of allApprovedJobs) {
      await ensurePaymentForJob(job);
    }

    let filter = { isDeleted: { $ne: true } };
    if (status && status !== 'ALL' && status !== 'TRASH') {
      filter.status = status.toUpperCase();
    }

    // Base query - only active records
    let payments = await RecruiterPayment.find(filter)
      .populate('jobId', 'title description eventType eventDate location workersRequired recruiterRequestedRate offeredAmountPerPerson recruiterProposedPayment adminApprovedPayment assignedWorkersCount')
      .populate('recruiterId', 'email phone')
      .sort({ createdAt: -1 });

    // Attach recruiter profiles
    const recruiterIds = [...new Set(payments.map((p) => p.recruiterId?._id).filter(Boolean))];
    const profiles = await RecruiterProfile.find({ userId: { $in: recruiterIds } });
    const profileMap = new Map(profiles.map((pr) => [pr.userId.toString(), pr]));

    const enrichedPayments = payments.map((p) => {
      const pObj = p.toObject();
      const profile = profileMap.get(p.recruiterId?._id?.toString());
      pObj.recruiterName = profile?.fullName || profile?.companyName || p.recruiterId?.email || 'Recruiter';
      pObj.recruiterEmail = p.recruiterId?.email || '';
      pObj.recruiterPhone = profile?.phone || p.recruiterId?.phone || '';
      pObj.companyName = profile?.companyName || '';
      // Normalize field names for frontend compatibility
      pObj.utrNumber = pObj.utr; // alias
      const rate = pObj.perPersonRate || pObj.jobId?.offeredAmountPerPerson || pObj.jobId?.recruiterProposedPayment || pObj.jobId?.recruiterRequestedRate || (pObj.verifiedAttendeesCount > 0 ? pObj.amount / pObj.verifiedAttendeesCount : 0);
      pObj.perPersonRate = rate;
      return pObj;
    });

    // Client-side search filter (recruiter name, email, company, job title, utr)
    let filtered = enrichedPayments;
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = enrichedPayments.filter((p) =>
        (p.recruiterName && p.recruiterName.toLowerCase().includes(q)) ||
        (p.recruiterEmail && p.recruiterEmail.toLowerCase().includes(q)) ||
        (p.companyName && p.companyName.toLowerCase().includes(q)) ||
        (p.jobId?.title && p.jobId.title.toLowerCase().includes(q)) ||
        (p.utr && p.utr.toLowerCase().includes(q)) ||
        (p.utrNumber && p.utrNumber.toLowerCase().includes(q))
      );
    }

    // Summary calculations across ALL ACTIVE records (not filtered)
    let totalAmount = 0;
    let pendingAmount = 0;
    let processingAmount = 0;
    let completedAmount = 0;
    let paidAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let paidCount = 0;
    let rejectedCount = 0;

    for (const p of enrichedPayments) {
      totalAmount += p.amount;
      switch (p.status) {
        case 'PAID':
          paidAmount += p.amount;
          paidCount += 1;
          break;
        case 'PROCESSING':
          processingAmount += p.amount;
          processingCount += 1;
          break;
        case 'COMPLETED':
          completedAmount += p.amount;
          completedCount += 1;
          break;
        case 'REJECTED':
          rejectedAmount += p.amount;
          rejectedCount += 1;
          break;
        default:
          pendingAmount += p.amount;
          pendingCount += 1;
      }
    }

    const trashCount = await RecruiterPayment.countDocuments({ isDeleted: true });

    // Paginate filtered results
    const totalDocs = filtered.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      payments: paginated,
      collections: paginated, // Alias
      data: paginated,
      trashCount,
      summary: {
        totalAmount,
        totalCollections: totalAmount,
        pendingAmount,
        processingAmount,
        completedAmount,
        paidAmount,
        rejectedAmount,
        totalCount: enrichedPayments.length,
        pendingCount,
        processingCount,
        completedCount,
        paidCount,
        rejectedCount,
        trashCount,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages: Math.ceil(totalDocs / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE PAYMENT STATUS (Admin Only) ──────────────────────────────────────
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const allowed = ['PENDING', 'PROCESSING', 'COMPLETED', 'PAID', 'REJECTED'];
    if (!status || !allowed.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowed.join(', ')}`,
      });
    }

    const targetStatus = status.toUpperCase();
    const payment = await RecruiterPayment.findById(id).populate('jobId');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter payment record not found.',
      });
    }

    const previousStatus = payment.status;
    payment.status = targetStatus;
    if (adminNotes !== undefined) payment.adminNotes = adminNotes;
    payment.reviewedByAdminId = req.user._id;
    payment.reviewedAt = new Date();
    await payment.save();

    // Sync job status
    if (payment.jobId) {
      await Job.findByIdAndUpdate(payment.jobId._id || payment.jobId, {
        recruiterPaymentStatus: targetStatus,
      });
    }

    const recruiterProfile = await RecruiterProfile.findOne({ userId: payment.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = payment.jobId?.title || 'Event';

    // Determine audit action
    let auditAction = 'RECRUITER_PAYMENT_STATUS_CHANGED';
    if (targetStatus === 'PAID') auditAction = 'RECRUITER_PAYMENT_MARKED_PAID';
    else if (targetStatus === 'REJECTED') auditAction = 'RECRUITER_PAYMENT_REJECTED';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: auditAction,
      entityName: 'RecruiterPayment',
      entityId: payment._id,
      previousValue: { status: previousStatus },
      newValue: { status: targetStatus, adminNotes: payment.adminNotes, reviewedAt: payment.reviewedAt },
      notes: `Admin updated recruiter payment status for event '${jobTitle}' from ${previousStatus} to ${targetStatus}.`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    // Notify recruiter of status update
    let notifTitle = 'Payment Status Updated';
    let notifMessage = `Your collection payment of ₹${payment.amount.toLocaleString('en-IN')} for '${jobTitle}' was updated to ${targetStatus}.`;
    let notifType = 'PAYMENT_UPDATED';

    if (targetStatus === 'PAID') {
      notifTitle = 'Payment Confirmed by Admin ✅';
      notifMessage = `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for '${jobTitle}' has been verified and marked as PAID.`;
      notifType = 'PAYMENT_VERIFIED';
    } else if (targetStatus === 'REJECTED') {
      notifTitle = 'Payment Verification Rejected ⚠️';
      notifMessage = `Your payment submission for '${jobTitle}' was rejected by Admin. Reason: ${adminNotes || 'Verification failed. Please re-submit valid UTR.'}`;
      notifType = 'PAYMENT_REJECTED';
    }

    await createNotification({
      userId: payment.recruiterId,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      link: '/recruiter/dashboard',
      relatedEntityType: 'RecruiterPayment',
      relatedEntityId: payment._id,
    });

    res.json({
      success: true,
      message: `Payment status updated to ${targetStatus}.`,
      payment,
      data: payment,
      collection: payment, // Alias
    });
  } catch (error) {
    next(error);
  }
};

// ── GET TRASH RECRUITER PAYMENTS / COLLECTIONS (Admin Only) ─────────────────
// GET /api/admin/recruiter-payments/trash
exports.getTrashRecruiterPayments = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    const payments = await RecruiterPayment.find({ isDeleted: true })
      .populate('jobId', 'title description eventType eventDate location workersRequired')
      .populate('recruiterId', 'email phone')
      .populate('deletedByAdminId', 'email')
      .sort({ deletedAt: -1 });

    const recruiterIds = [...new Set(payments.map((p) => p.recruiterId?._id).filter(Boolean))];
    const profiles = await RecruiterProfile.find({ userId: { $in: recruiterIds } });
    const profileMap = new Map(profiles.map((pr) => [pr.userId.toString(), pr]));

    const enriched = payments.map((p) => {
      const pObj = p.toObject();
      const profile = profileMap.get(p.recruiterId?._id?.toString());
      pObj.recruiterName = profile?.fullName || profile?.companyName || p.recruiterId?.email || 'Recruiter';
      pObj.recruiterEmail = p.recruiterId?.email || '';
      pObj.recruiterPhone = profile?.phone || p.recruiterId?.phone || '';
      pObj.companyName = profile?.companyName || '';
      pObj.utrNumber = pObj.utr;
      return pObj;
    });

    let filtered = enriched;
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = enriched.filter((p) =>
        (p.recruiterName && p.recruiterName.toLowerCase().includes(q)) ||
        (p.recruiterEmail && p.recruiterEmail.toLowerCase().includes(q)) ||
        (p.companyName && p.companyName.toLowerCase().includes(q)) ||
        (p.jobId?.title && p.jobId.title.toLowerCase().includes(q)) ||
        (p.utr && p.utr.toLowerCase().includes(q)) ||
        (p.utrNumber && p.utrNumber.toLowerCase().includes(q))
      );
    }

    const totalDocs = filtered.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      payments: paginated,
      collections: paginated,
      data: paginated,
      trashCount: enriched.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages: Math.ceil(totalDocs / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── SOFT DELETE RECRUITER PAYMENT / COLLECTION (Admin Only) ─────────────────
// DELETE /api/admin/recruiter-payments/:id
exports.softDeleteRecruiterPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await RecruiterPayment.findById(id).populate('jobId', 'title');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Collection record not found.' });
    }
    if (payment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Collection record is already in trash.' });
    }

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    payment.isDeleted = true;
    payment.deletedAt = now;
    payment.permanentDeleteAt = permanentDeleteAt;
    payment.deletedByAdminId = req.user._id;
    await payment.save();

    const recruiterProfile = await RecruiterProfile.findOne({ userId: payment.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = payment.jobId?.title || 'Event';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_DELETED',
      entityName: 'RecruiterPayment',
      entityId: payment._id,
      previousValue: { status: payment.status, isDeleted: false },
      newValue: { isDeleted: true, deletedAt: now, permanentDeleteAt },
      notes: `Admin moved Recruiter Collection record to trash. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${payment.amount}. Payment status unchanged: ${payment.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    res.json({
      success: true,
      message: 'Collection record moved to trash.',
      payment,
      collection: payment,
    });
  } catch (error) {
    next(error);
  }
};

// ── RESTORE RECRUITER PAYMENT / COLLECTION (Admin Only) ─────────────────────
// POST /api/admin/recruiter-payments/:id/restore
exports.restoreRecruiterPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await RecruiterPayment.findById(id).populate('jobId', 'title');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Collection record not found.' });
    }
    if (!payment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Collection record is not in trash.' });
    }

    payment.isDeleted = false;
    payment.deletedAt = null;
    payment.permanentDeleteAt = null;
    payment.deletedByAdminId = null;
    await payment.save();

    const recruiterProfile = await RecruiterProfile.findOne({ userId: payment.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = payment.jobId?.title || 'Event';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_RESTORED',
      entityName: 'RecruiterPayment',
      entityId: payment._id,
      previousValue: { isDeleted: true },
      newValue: { isDeleted: false },
      notes: `Admin restored Recruiter Collection record from trash. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${payment.amount}. Status: ${payment.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    res.json({
      success: true,
      message: 'Collection record restored successfully.',
      payment,
      collection: payment,
    });
  } catch (error) {
    next(error);
  }
};

// ── PERMANENTLY DELETE RECRUITER PAYMENT / COLLECTION (Admin Only) ──────────
// DELETE /api/admin/recruiter-payments/:id/permanent
exports.permanentDeleteRecruiterPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await RecruiterPayment.findById(id).populate('jobId', 'title');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Collection record not found.' });
    }
    if (!payment.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Collection record must be in trash before permanent deletion.',
      });
    }

    const recruiterProfile = await RecruiterProfile.findOne({ userId: payment.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = payment.jobId?.title || 'Event';

    // Log before removing from database
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_PERMANENTLY_DELETED',
      entityName: 'RecruiterPayment',
      entityId: payment._id,
      previousValue: { status: payment.status, amount: payment.amount, isDeleted: true },
      newValue: null,
      notes: `Admin permanently deleted Recruiter Collection record. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${payment.amount}. Final status was: ${payment.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    // Mark job so it will not auto-recreate a duplicate collection record
    if (payment.jobId) {
      await Job.findByIdAndUpdate(payment.jobId._id || payment.jobId, {
        recruiterCollectionPermanentlyDeleted: true,
      });
    }

    await RecruiterPayment.findByIdAndDelete(payment._id);

    res.json({
      success: true,
      message: 'Collection record permanently deleted from database.',
    });
  } catch (error) {
    next(error);
  }
};

// ── BULK SOFT DELETE (Admin Only) ────────────────────────────────────────────
// POST /api/admin/recruiter-payments/bulk/delete
exports.bulkSoftDeleteRecruiterPayments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const records = await RecruiterPayment.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible collection records found for deletion.' });
    }

    await RecruiterPayment.updateMany(
      { _id: { $in: records.map((r) => r._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt, deletedByAdminId: req.user._id } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'RecruiterPayment',
      entityId: req.user._id,
      notes: `Admin bulk moved ${records.length} Recruiter Collection record(s) to trash. IDs: ${records.map((r) => r._id).join(', ')}`,
    });

    res.json({
      success: true,
      message: `${records.length} collection record(s) moved to trash.`,
      count: records.length,
    });
  } catch (error) {
    next(error);
  }
};

// ── BULK RESTORE (Admin Only) ────────────────────────────────────────────────
// POST /api/admin/recruiter-payments/bulk/restore
exports.bulkRestoreRecruiterPayments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const records = await RecruiterPayment.find({ _id: { $in: ids }, isDeleted: true });
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible collection records found in trash.' });
    }

    await RecruiterPayment.updateMany(
      { _id: { $in: records.map((r) => r._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null, deletedByAdminId: null } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'RecruiterPayment',
      entityId: req.user._id,
      notes: `Admin bulk restored ${records.length} Recruiter Collection record(s) from trash. IDs: ${records.map((r) => r._id).join(', ')}`,
    });

    res.json({
      success: true,
      message: `${records.length} collection record(s) restored.`,
      count: records.length,
    });
  } catch (error) {
    next(error);
  }
};

// ── BULK PERMANENT DELETE (Admin Only) ───────────────────────────────────────
// POST /api/admin/recruiter-payments/bulk/permanent-delete
exports.bulkPermanentDeleteRecruiterPayments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const records = await RecruiterPayment.find({ _id: { $in: ids }, isDeleted: true });
    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible collection records found in trash for permanent deletion.',
      });
    }

    const jobIds = records.map((r) => r.jobId).filter(Boolean);
    if (jobIds.length > 0) {
      await Job.updateMany(
        { _id: { $in: jobIds } },
        { $set: { recruiterCollectionPermanentlyDeleted: true } }
      );
    }

    await RecruiterPayment.deleteMany({ _id: { $in: records.map((r) => r._id) } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'RecruiterPayment',
      entityId: req.user._id,
      notes: `Admin permanently deleted ${records.length} Recruiter Collection record(s). IDs: ${records.map((r) => r._id).join(', ')}`,
    });

    res.json({
      success: true,
      message: `${records.length} collection record(s) permanently deleted.`,
      count: records.length,
    });
  } catch (error) {
    next(error);
  }
};

