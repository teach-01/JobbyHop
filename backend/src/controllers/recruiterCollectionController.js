const RecruiterCollection = require('../models/RecruiterCollection');
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
 * Helper: ensure an approved Job has a corresponding RecruiterCollection record.
 * Uses verified PRESENT attendance calculation for pre-submission PENDING payments.
 * Submitted (PROCESSING/COMPLETED/PAID) amounts are locked and preserved.
 */
const ensureCollectionForJob = async (job) => {
  if (job.recruiterCollectionPermanentlyDeleted) {
    return null;
  }
  let collection = await RecruiterCollection.findOne({ jobId: job._id });
  const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(job._id);

  const fallbackAmount = Number(
    job.recruiterPaymentAmount ||
    job.offeredTotalAmount ||
    ((job.offeredAmountPerPerson || job.recruiterProposedPayment || 0) * (job.workersRequired || 1))
  );
  const targetAmount = eligibleCount > 0 ? totalPayable : fallbackAmount;
  const targetRate = perPersonRate || Number(job.offeredAmountPerPerson || job.recruiterProposedPayment || 0);

  if (!collection) {
    collection = await RecruiterCollection.create({
      recruiterId: job.recruiterId,
      jobId: job._id,
      amount: targetAmount,
      perPersonRate: targetRate,
      verifiedAttendeesCount: eligibleCount,
      status: 'PENDING',
    });
    // Sync on job model
    job.recruiterPaymentAmount = targetAmount;
    job.recruiterPaymentStatus = 'PENDING';
    await job.save();
  } else if (!collection.isDeleted && collection.status === 'PENDING') {
    let changed = false;
    if (collection.amount !== targetAmount || collection.verifiedAttendeesCount !== eligibleCount || collection.perPersonRate !== targetRate) {
      collection.amount = targetAmount;
      collection.verifiedAttendeesCount = eligibleCount;
      collection.perPersonRate = targetRate;
      changed = true;
    }
    if (changed) {
      await collection.save();
    }
    if (job.recruiterPaymentAmount !== targetAmount) {
      job.recruiterPaymentAmount = targetAmount;
      await job.save();
    }
  }
  return collection;
};

// ── GET RECRUITER'S OWN COLLECTIONS (Recruiter) ─────────────────────────────
exports.getMyCollections = async (req, res, next) => {
  try {
    const recruiterUserId = req.user._id;

    // Automatically sync any approved jobs for this recruiter
    const approvedJobs = await Job.find({
      recruiterId: recruiterUserId,
      status: { $in: [JOB_STATUS.APPROVED, JOB_STATUS.COMPLETED] },
      recruiterCollectionPermanentlyDeleted: { $ne: true },
    });

    for (const job of approvedJobs) {
      await ensureCollectionForJob(job);
    }

    // IMPORTANT: Recruiters see ALL their collection records regardless of isDeleted.
    // isDeleted is an Admin-only administrative lifecycle flag.
    const collections = await RecruiterCollection.find({
      recruiterId: recruiterUserId,
    })
      .populate('jobId', 'title description eventType eventDate startTime endTime location workersRequired recruiterRequestedRate offeredAmountPerPerson recruiterProposedPayment')
      .sort({ createdAt: -1 });

    let pendingAmount = 0;
    let processingAmount = 0;
    let paidAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let paidCount = 0;
    let rejectedCount = 0;

    for (const c of collections) {
      if (c.status === 'PAID') {
        paidAmount += c.amount;
        paidCount += 1;
      } else if (c.status === 'PROCESSING') {
        processingAmount += c.amount;
        processingCount += 1;
      } else if (c.status === 'REJECTED') {
        rejectedAmount += c.amount;
        rejectedCount += 1;
      } else {
        pendingAmount += c.amount;
        pendingCount += 1;
      }
    }

    const summary = {
      totalAmount: pendingAmount + processingAmount + paidAmount,
      totalCollections: pendingAmount + processingAmount + paidAmount,
      pendingAmount,
      processingAmount,
      paidAmount,
      rejectedAmount,
      totalCount: collections.length,
      pendingCount,
      processingCount,
      paidCount,
      rejectedCount,
    };

    const sanitizedCollections = collections.map((c) => {
      const obj = c.toObject ? c.toObject() : { ...c };
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
      collections: sanitizedCollections,
      data: sanitizedCollections,
      payments: sanitizedCollections, // Compatibility alias
      summary,
    });
  } catch (error) {
    next(error);
  }
};

// ── SUBMIT PAYMENT (Recruiter pays JobbyHop Admin) ───────────────────────────
// Accessible at POST /api/recruiter/recruiter-collections or /api/recruiter-collections/:id/submit
exports.submitCollectionPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { collectionId, jobId, utr, utrNumber, paymentMethod, paymentProof, notes } = req.body;

    const targetId = id || collectionId;
    const utrVal = utrNumber || utr;

    // 1. Validate UTR / Transaction Reference
    if (!utrVal || typeof utrVal !== 'string' || utrVal.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'UTR / Transaction Number is required.',
      });
    }

    const trimmedUtr = utrVal.trim();
    if (trimmedUtr.length < 6 || trimmedUtr.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'UTR / Transaction Number must be between 6 and 50 characters.',
      });
    }

    // 2. Fetch or locate collection record
    let collection;
    if (targetId) {
      collection = await RecruiterCollection.findById(targetId).populate('jobId');
    } else if (jobId) {
      collection = await RecruiterCollection.findOne({ jobId }).populate('jobId');
      if (!collection) {
        const job = await Job.findById(jobId);
        if (job) {
          collection = await ensureCollectionForJob(job);
          await collection.populate('jobId');
        }
      }
    }

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter collection record not found.',
      });
    }

    // 3. Authorization check: recruiter can only pay for their own records
    if (collection.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit payment for this collection record.',
      });
    }

    // 4. Duplicate payment check: already PAID
    if (collection.status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'This payment has already been marked as PAID and cannot be resubmitted.',
      });
    }

    // 5. Backend calculation validation: compute latest eligible attendance & rate or fallback to offer
    const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(collection.jobId._id || collection.jobId);
    const job = collection.jobId;
    const fallbackAmount = Number(
      job?.recruiterPaymentAmount ||
      job?.offeredTotalAmount ||
      ((job?.offeredAmountPerPerson || job?.recruiterProposedPayment || 0) * (job?.workersRequired || 1))
    );
    const finalAmount = eligibleCount > 0 ? totalPayable : (collection.amount || fallbackAmount);
    const finalRate = perPersonRate || Number(job?.offeredAmountPerPerson || job?.recruiterProposedPayment || 0);

    if (finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit payment: Payment amount must be greater than zero.',
      });
    }

    // 6. Check for duplicate UTR across existing confirmed paid collections
    const existingUtr = await RecruiterCollection.findOne({
      _id: { $ne: collection._id },
      utrNumber: trimmedUtr,
      status: 'PAID',
    });
    if (existingUtr) {
      return res.status(400).json({
        success: false,
        message: 'This UTR / Transaction Number has already been confirmed for another payment.',
      });
    }

    // 7. Lock collection amount & verifiedAttendeesCount, update status to PROCESSING
    const previousStatus = collection.status;
    collection.amount = finalAmount;
    collection.perPersonRate = finalRate;
    collection.verifiedAttendeesCount = eligibleCount;
    collection.status = 'PROCESSING';
    collection.utrNumber = trimmedUtr;
    collection.paymentMethod = paymentMethod && ['UPI', 'Bank Transfer', 'Other'].includes(paymentMethod)
      ? paymentMethod
      : 'UPI';
    collection.paymentDate = new Date();
    if (paymentProof) collection.paymentProof = paymentProof;
    if (notes) collection.notes = notes;
    await collection.save();

    // 8. Update Job status & locked amount
    if (job) {
      await Job.findByIdAndUpdate(job._id || job, {
        recruiterPaymentAmount: finalAmount,
        recruiterPaymentStatus: 'PROCESSING',
      });
    }

    // 9. Fetch recruiter profile for notification and audit log
    const recruiterProfile = await RecruiterProfile.findOne({ userId: req.user._id });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || req.user.email || 'Recruiter';
    const jobTitle = job?.title || 'Event';

    // 10. Audit Log: payment submitted
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.RECRUITER,
      action: 'RECRUITER_COLLECTION_SUBMITTED',
      entityName: 'RecruiterCollection',
      entityId: collection._id,
      previousValue: { status: previousStatus },
      newValue: {
        status: collection.status,
        amount: collection.amount,
        utrNumber: collection.utrNumber,
        paymentMethod: collection.paymentMethod,
        paymentDate: collection.paymentDate,
        jobId: job?._id || job,
        jobTitle,
      },
      notes: `Recruiter submitted collection payment of ₹${collection.amount} for event '${jobTitle}'. UTR: ${collection.utrNumber}, Method: ${collection.paymentMethod}.`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    // 11. Create Admin Notifications
    const admins = await User.find({ role: ROLES.ADMIN });
    for (const admin of admins) {
      await createNotification({
        userId: admin._id,
        title: 'Recruiter payment received',
        message: `${recruiterName} has submitted a payment of ₹${collection.amount.toLocaleString('en-IN')} for ${jobTitle}.`,
        type: 'RECRUITER_PAYMENT_RECEIVED',
        link: '/admin/recruiter-collections',
        relatedEntityType: 'RecruiterCollection',
        relatedEntityId: collection._id,
      });
    }

    // 12. Create Recruiter Confirmation Notification
    await createNotification({
      userId: req.user._id,
      title: 'Payment Submitted Successfully',
      message: `Your payment of ₹${collection.amount.toLocaleString('en-IN')} for '${jobTitle}' has been submitted. Status: In Review (Processing).`,
      type: 'PAYMENT_SUBMITTED',
      link: '/recruiter/dashboard',
      relatedEntityType: 'RecruiterCollection',
      relatedEntityId: collection._id,
    });

    res.json({
      success: true,
      message: 'Payment details submitted successfully. Status updated to In Review (Processing).',
      collection,
      payment: collection, // Compatibility alias
    });
  } catch (error) {
    next(error);
  }
};

// ── GET SINGLE COLLECTION DETAILS ───────────────────────────────────────────
// GET /api/admin/recruiter-collections/:id or /api/recruiter-collections/:id
exports.getCollectionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await RecruiterCollection.findById(id)
      .populate('jobId', 'title description eventType eventDate startTime endTime location workersRequired recruiterRequestedRate offeredAmountPerPerson recruiterProposedPayment')
      .populate('recruiterId', 'email phone');

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter collection record not found.',
      });
    }

    // Role check: recruiter can only view own; admin can view any
    if (
      req.user.role === ROLES.RECRUITER &&
      collection.recruiterId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this collection record.',
      });
    }

    if (collection.status === 'PENDING') {
      const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(collection.jobId._id || collection.jobId);
      if (collection.amount !== totalPayable || collection.verifiedAttendeesCount !== eligibleCount || collection.perPersonRate !== perPersonRate) {
        collection.amount = totalPayable;
        collection.verifiedAttendeesCount = eligibleCount;
        collection.perPersonRate = perPersonRate;
        await collection.save();
      }
    }

    const recruiterProfile = await RecruiterProfile.findOne({ userId: collection.recruiterId._id });

    const collectionObj = collection.toObject ? collection.toObject() : { ...collection };
    const job = collectionObj.jobId || {};
    const rate = collectionObj.perPersonRate ?? (typeof job === 'object' && job !== null ? (job.offeredAmountPerPerson ?? job.recruiterProposedPayment ?? job.recruiterRequestedRate) : null) ?? 0;
    collectionObj.perPersonRate = rate;
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
      collection: collectionObj,
      payment: collectionObj, // Compatibility alias
      recruiterProfile,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET ALL RECRUITER COLLECTIONS (Admin View) ──────────────────────────────
// GET /api/admin/recruiter-collections
exports.getAllRecruiterCollections = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    // Sync any approved jobs in system that lack a RecruiterCollection
    const allApprovedJobs = await Job.find({
      status: { $in: [JOB_STATUS.APPROVED, JOB_STATUS.COMPLETED] },
      isDeleted: { $ne: true },
      recruiterCollectionPermanentlyDeleted: { $ne: true },
    });
    for (const job of allApprovedJobs) {
      await ensureCollectionForJob(job);
    }

    let filter = { isDeleted: { $ne: true } };
    if (status && status !== 'ALL' && status !== 'TRASH') {
      filter.status = status.toUpperCase();
    }

    const collections = await RecruiterCollection.find(filter)
      .populate('jobId', 'title description eventType eventDate location workersRequired')
      .populate('recruiterId', 'email phone')
      .sort({ createdAt: -1 });

    // Attach recruiter profiles
    const recruiterIds = [...new Set(collections.map((c) => c.recruiterId?._id).filter(Boolean))];
    const profiles = await RecruiterProfile.find({ userId: { $in: recruiterIds } });
    const profileMap = new Map(profiles.map((pr) => [pr.userId.toString(), pr]));

    const enrichedCollections = collections.map((c) => {
      const cObj = c.toObject();
      const profile = profileMap.get(c.recruiterId?._id?.toString());
      cObj.recruiterName = profile?.fullName || profile?.companyName || c.recruiterId?.email || 'Recruiter';
      cObj.recruiterEmail = c.recruiterId?.email || '';
      cObj.recruiterPhone = profile?.phone || c.recruiterId?.phone || '';
      cObj.companyName = profile?.companyName || '';
      cObj.utr = c.utrNumber; // Compatibility alias
      return cObj;
    });

    // Client/query search filter
    let filtered = enrichedCollections;
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = enrichedCollections.filter((c) =>
        (c.recruiterName && c.recruiterName.toLowerCase().includes(q)) ||
        (c.recruiterEmail && c.recruiterEmail.toLowerCase().includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.jobId?.title && c.jobId.title.toLowerCase().includes(q)) ||
        (c.utrNumber && c.utrNumber.toLowerCase().includes(q))
      );
    }

    // Summary calculations across ALL ACTIVE records (not filtered)
    let totalAmount = 0;
    let pendingAmount = 0;
    let processingAmount = 0;
    let paidAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let paidCount = 0;
    let rejectedCount = 0;

    for (const c of enrichedCollections) {
      if (c.status === 'PAID') {
        paidAmount += c.amount;
        paidCount += 1;
      } else if (c.status === 'PROCESSING') {
        processingAmount += c.amount;
        processingCount += 1;
      } else if (c.status === 'REJECTED') {
        rejectedAmount += c.amount;
        rejectedCount += 1;
      } else {
        pendingAmount += c.amount;
        pendingCount += 1;
      }
      totalAmount += c.amount;
    }

    const trashCount = await RecruiterCollection.countDocuments({ isDeleted: true });

    // Paginate filtered results
    const totalDocs = filtered.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      collections: paginated,
      payments: paginated, // Compatibility alias
      trashCount,
      summary: {
        totalAmount,
        totalCollections: totalAmount,
        pendingAmount,
        processingAmount,
        paidAmount,
        rejectedAmount,
        totalCount: enrichedCollections.length,
        pendingCount,
        processingCount,
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

// ── UPDATE COLLECTION STATUS (Admin Only) ───────────────────────────────────
// PATCH /api/admin/recruiter-collections/:id/status
exports.updateCollectionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const allowedStatuses = ['PENDING', 'PROCESSING', 'PAID', 'REJECTED'];
    if (!status || !allowedStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      });
    }

    const targetStatus = status.toUpperCase();

    const collection = await RecruiterCollection.findById(id).populate('jobId');
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter collection record not found.',
      });
    }

    const previousStatus = collection.status;
    collection.status = targetStatus;
    if (adminNotes !== undefined) {
      collection.adminNotes = adminNotes;
    }
    collection.reviewedByAdminId = req.user._id;
    collection.reviewedAt = new Date();
    await collection.save();

    // Sync status to job
    const job = collection.jobId;
    if (job) {
      await Job.findByIdAndUpdate(job._id || job, {
        recruiterPaymentStatus: targetStatus,
      });
    }

    // Fetch recruiter for audit & notification
    const recruiterProfile = await RecruiterProfile.findOne({ userId: collection.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = job?.title || 'Event';

    // ── Audit Log ────────────────────────────────────────────────────────────
    let auditAction = 'RECRUITER_COLLECTION_STATUS_CHANGED';
    if (targetStatus === 'PAID') {
      auditAction = 'RECRUITER_COLLECTION_MARKED_PAID';
    } else if (targetStatus === 'REJECTED') {
      auditAction = 'RECRUITER_COLLECTION_REJECTED';
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: auditAction,
      entityName: 'RecruiterCollection',
      entityId: collection._id,
      previousValue: { status: previousStatus },
      newValue: {
        status: targetStatus,
        adminNotes: collection.adminNotes,
        reviewedAt: collection.reviewedAt,
      },
      notes: `Admin updated Recruiter Collection status from ${previousStatus} to ${targetStatus} for event '${jobTitle}'. Notes: ${adminNotes || 'N/A'}.`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    // ── Notify Recruiter ─────────────────────────────────────────────────────
    let notifTitle = 'Payment Status Updated';
    let notifMessage = `Your collection payment of ₹${collection.amount.toLocaleString('en-IN')} for '${jobTitle}' was marked as ${targetStatus}.`;
    let notifType = 'PAYMENT_UPDATED';

    if (targetStatus === 'PAID') {
      notifTitle = 'Payment Confirmed by Admin ✅';
      notifMessage = `Your payment of ₹${collection.amount.toLocaleString('en-IN')} for '${jobTitle}' has been verified and marked as PAID.`;
      notifType = 'PAYMENT_VERIFIED';
    } else if (targetStatus === 'REJECTED') {
      notifTitle = 'Payment Verification Rejected ⚠️';
      notifMessage = `Your payment submission for '${jobTitle}' was rejected by Admin. Reason: ${adminNotes || 'Verification failed. Please re-submit valid UTR.'}`;
      notifType = 'PAYMENT_REJECTED';
    }

    await createNotification({
      userId: collection.recruiterId,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      link: '/recruiter/dashboard',
      relatedEntityType: 'RecruiterCollection',
      relatedEntityId: collection._id,
    });

    res.json({
      success: true,
      message: `Recruiter collection status updated to ${targetStatus}.`,
      collection,
      payment: collection, // Compatibility alias
    });
  } catch (error) {
    next(error);
  }
};

// ── GET TRASH RECRUITER COLLECTIONS (Admin Only) ────────────────────────────
// GET /api/admin/recruiter-collections/trash
exports.getTrashRecruiterCollections = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    const collections = await RecruiterCollection.find({ isDeleted: true })
      .populate('jobId', 'title description eventType eventDate location workersRequired')
      .populate('recruiterId', 'email phone')
      .populate('deletedByAdminId', 'email')
      .sort({ deletedAt: -1 });

    const recruiterIds = [...new Set(collections.map((c) => c.recruiterId?._id).filter(Boolean))];
    const profiles = await RecruiterProfile.find({ userId: { $in: recruiterIds } });
    const profileMap = new Map(profiles.map((pr) => [pr.userId.toString(), pr]));

    const enriched = collections.map((c) => {
      const cObj = c.toObject();
      const profile = profileMap.get(c.recruiterId?._id?.toString());
      cObj.recruiterName = profile?.fullName || profile?.companyName || c.recruiterId?.email || 'Recruiter';
      cObj.recruiterEmail = c.recruiterId?.email || '';
      cObj.recruiterPhone = profile?.phone || c.recruiterId?.phone || '';
      cObj.companyName = profile?.companyName || '';
      cObj.utr = c.utrNumber;
      return cObj;
    });

    let filtered = enriched;
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = enriched.filter((c) =>
        (c.recruiterName && c.recruiterName.toLowerCase().includes(q)) ||
        (c.recruiterEmail && c.recruiterEmail.toLowerCase().includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.jobId?.title && c.jobId.title.toLowerCase().includes(q)) ||
        (c.utrNumber && c.utrNumber.toLowerCase().includes(q))
      );
    }

    const totalDocs = filtered.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      collections: paginated,
      payments: paginated,
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

// ── SOFT DELETE RECRUITER COLLECTION (Admin Only) ───────────────────────────
// DELETE /api/admin/recruiter-collections/:id
exports.softDeleteRecruiterCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await RecruiterCollection.findById(id).populate('jobId', 'title');
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Recruiter collection record not found.' });
    }
    if (collection.isDeleted) {
      return res.status(400).json({ success: false, message: 'Collection record is already in trash.' });
    }

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    collection.isDeleted = true;
    collection.deletedAt = now;
    collection.permanentDeleteAt = permanentDeleteAt;
    collection.deletedByAdminId = req.user._id;
    await collection.save();

    const recruiterProfile = await RecruiterProfile.findOne({ userId: collection.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = collection.jobId?.title || 'Event';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_DELETED',
      entityName: 'RecruiterCollection',
      entityId: collection._id,
      previousValue: { status: collection.status, isDeleted: false },
      newValue: { isDeleted: true, deletedAt: now, permanentDeleteAt },
      notes: `Admin moved Recruiter Collection record to trash. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${collection.amount}. Payment status unchanged: ${collection.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    res.json({
      success: true,
      message: 'Collection record moved to trash.',
      collection,
      payment: collection,
    });
  } catch (error) {
    next(error);
  }
};

// ── RESTORE RECRUITER COLLECTION (Admin Only) ───────────────────────────────
// POST /api/admin/recruiter-collections/:id/restore
exports.restoreRecruiterCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await RecruiterCollection.findById(id).populate('jobId', 'title');
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Recruiter collection record not found.' });
    }
    if (!collection.isDeleted) {
      return res.status(400).json({ success: false, message: 'Collection record is not in trash.' });
    }

    collection.isDeleted = false;
    collection.deletedAt = null;
    collection.permanentDeleteAt = null;
    collection.deletedByAdminId = null;
    await collection.save();

    const recruiterProfile = await RecruiterProfile.findOne({ userId: collection.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = collection.jobId?.title || 'Event';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_RESTORED',
      entityName: 'RecruiterCollection',
      entityId: collection._id,
      previousValue: { isDeleted: true },
      newValue: { isDeleted: false },
      notes: `Admin restored Recruiter Collection record from trash. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${collection.amount}. Status: ${collection.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    res.json({
      success: true,
      message: 'Collection record restored successfully.',
      collection,
      payment: collection,
    });
  } catch (error) {
    next(error);
  }
};

// ── PERMANENTLY DELETE RECRUITER COLLECTION (Admin Only) ────────────────────
// DELETE /api/admin/recruiter-collections/:id/permanent
exports.permanentDeleteRecruiterCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await RecruiterCollection.findById(id).populate('jobId', 'title');
    if (!collection) {
      return res.status(404).json({ success: false, message: 'Recruiter collection record not found.' });
    }
    if (!collection.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Collection record must be in trash before permanent deletion.',
      });
    }

    const recruiterProfile = await RecruiterProfile.findOne({ userId: collection.recruiterId });
    const recruiterName = recruiterProfile?.fullName || recruiterProfile?.companyName || 'Recruiter';
    const jobTitle = collection.jobId?.title || 'Event';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RECRUITER_COLLECTION_PERMANENTLY_DELETED',
      entityName: 'RecruiterCollection',
      entityId: collection._id,
      previousValue: { status: collection.status, amount: collection.amount, isDeleted: true },
      newValue: null,
      notes: `Admin permanently deleted Recruiter Collection record. Recruiter: ${recruiterName}. Event: ${jobTitle}. Amount: ₹${collection.amount}. Final status was: ${collection.status}`,
      subjectName: recruiterName,
      subjectRole: ROLES.RECRUITER,
    });

    if (collection.jobId) {
      await Job.findByIdAndUpdate(collection.jobId._id || collection.jobId, {
        recruiterCollectionPermanentlyDeleted: true,
      });
    }

    await RecruiterCollection.findByIdAndDelete(collection._id);

    res.json({
      success: true,
      message: 'Collection record permanently deleted from database.',
    });
  } catch (error) {
    next(error);
  }
};

// ── BULK SOFT DELETE (Admin Only) ────────────────────────────────────────────
// POST /api/admin/recruiter-collections/bulk/delete
exports.bulkSoftDeleteRecruiterCollections = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const records = await RecruiterCollection.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible collection records found for deletion.' });
    }

    await RecruiterCollection.updateMany(
      { _id: { $in: records.map((r) => r._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt, deletedByAdminId: req.user._id } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'RecruiterCollection',
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
// POST /api/admin/recruiter-collections/bulk/restore
exports.bulkRestoreRecruiterCollections = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const records = await RecruiterCollection.find({ _id: { $in: ids }, isDeleted: true });
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible collection records found in trash.' });
    }

    await RecruiterCollection.updateMany(
      { _id: { $in: records.map((r) => r._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null, deletedByAdminId: null } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'RecruiterCollection',
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
// POST /api/admin/recruiter-collections/bulk/permanent-delete
exports.bulkPermanentDeleteRecruiterCollections = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });
    }

    const records = await RecruiterCollection.find({ _id: { $in: ids }, isDeleted: true });
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

    await RecruiterCollection.deleteMany({ _id: { $in: records.map((r) => r._id) } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'RecruiterCollection',
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

