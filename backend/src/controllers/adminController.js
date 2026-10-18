const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const WorkerProfile = require('../models/WorkerProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const RecruiterPayment = require('../models/RecruiterPayment');
const CancellationRequest = require('../models/CancellationRequest');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../services/notificationService');
const { logAuditEvent } = require('../services/auditService');
const { JOB_STATUS, APPLICATION_STATUS, ASSIGNMENT_STATUS, ATTENDANCE_STATUS, PAYMENT_STATUS, CANCELLATION_STATUS, ROLES } = require('../config/constants');
const { deleteSavedImage, duplicateSavedImage } = require('../utils/imageStorage');
const { calculateAttendancePayable } = require('../utils/paymentCalculator');

// Admin Dashboard Overview Statistics
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalRecruiters = await User.countDocuments({ role: ROLES.RECRUITER, status: { $ne: 'DELETED' }, isDeleted: { $ne: true } });
    const totalWorkers = await User.countDocuments({ role: ROLES.WORKER, status: { $ne: 'DELETED' }, isDeleted: { $ne: true } });
    const pendingJobRequests = await Job.countDocuments({ status: JOB_STATUS.PENDING_REVIEW, isDeleted: { $ne: true } });
    const approvedJobs = await Job.countDocuments({ status: JOB_STATUS.APPROVED, isDeleted: { $ne: true } });
    const rejectedJobs = await Job.countDocuments({ status: JOB_STATUS.REJECTED, isDeleted: { $ne: true } });
    const completedEvents = await Job.countDocuments({ status: JOB_STATUS.COMPLETED, isDeleted: { $ne: true } });

    const pendingApplications = await Application.countDocuments({ status: APPLICATION_STATUS.APPLIED, isDeleted: { $ne: true } });
    const activeAssignments = await Assignment.countDocuments({ status: ASSIGNMENT_STATUS.ASSIGNED, isDeleted: { $ne: true } });

    const pendingPayments = await Payment.countDocuments({ status: PAYMENT_STATUS.PENDING, isDeleted: { $ne: true } });
    const processingPayments = await Payment.countDocuments({ status: PAYMENT_STATUS.PROCESSING, isDeleted: { $ne: true } });
    const paidPayments = await Payment.countDocuments({ status: PAYMENT_STATUS.PAID, isDeleted: { $ne: true } });

    const pendingCancellations = await CancellationRequest.countDocuments({ status: CANCELLATION_STATUS.PENDING, isDeleted: { $ne: true } });

    // Recent activity feed (audit logs)
    const recentActivity = await AuditLog.find()
      .populate('performedByUserId', 'email role')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalRecruiters,
        totalWorkers,
        pendingJobRequests,
        approvedJobs,
        rejectedJobs,
        completedEvents,
        pendingApplications,
        activeAssignments,
        pendingPayments,
        processingPayments,
        paidPayments,
        pendingCancellations,
      },
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

// Event Statistics for Dashboard (upcoming + completed, trash-excluded)
exports.getEventStats = async (req, res, next) => {
  try {
    // Non-trashed events that are "active/upcoming"
    // Matches isActiveEvent() logic in AdminEvents.jsx:
    //   status != COMPLETED AND (APPROVED|SUSPENDED|IN_PROGRESS|PENDING_REVIEW OR (REJECTED AND acceptedAt set))
    const upcomingEvents = await Job.countDocuments({
      isDeleted: { $ne: true },
      $or: [
        { status: { $in: [JOB_STATUS.APPROVED, JOB_STATUS.SUSPENDED, JOB_STATUS.OPEN, JOB_STATUS.CLOSED] } },
        { status: JOB_STATUS.PENDING_REVIEW },
        { status: JOB_STATUS.REJECTED, acceptedAt: { $ne: null } },
      ],
    });

    // Non-trashed events that are completed
    const completedEvents = await Job.countDocuments({
      isDeleted: { $ne: true },
      status: JOB_STATUS.COMPLETED,
    });

    // Trashed events count (informational)
    const trashedEvents = await Job.countDocuments({ isDeleted: true });

    res.json({
      success: true,
      stats: {
        upcomingEvents,
        completedEvents,
        trashedEvents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Job Requests Approval Queue
exports.getJobRequests = async (req, res, next) => {
  try {
    const {
      status = 'ALL',
      search,
      page = 1,
      limit = 10,
      eventType,
      dateFrom,
      dateTo,
      createdFrom,
      createdTo,
      payMin,
      payMax,
      sort = 'newest',
    } = req.query;

    const query = { isDeleted: { $ne: true } };
    if (status === 'APPROVED') {
      // "Accepted / Approved" = approval HISTORY — any job the Admin approved,
      // regardless of its current lifecycle status (COMPLETED, EVENT_COMPLETED, etc.)
      query.acceptedAt = { $ne: null };
      // Exclude jobs that are currently rejected (edge-case safety)
      query.status = { $ne: JOB_STATUS.REJECTED };
    } else if (status !== 'ALL') {
      query.status = status;
    }

    // Event type filter
    if (eventType && eventType !== 'ALL') {
      query.eventType = eventType;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.eventDate = {};
      if (dateFrom) query.eventDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo.trim())) {
          toDate.setHours(23, 59, 59, 999);
        }
        query.eventDate.$lte = toDate;
      }
    }

    // Submission / Creation date range filter
    if (createdFrom || createdTo) {
      query.createdAt = {};
      if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
      if (createdTo) {
        const toDate = new Date(createdTo);
        if (typeof createdTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(createdTo.trim())) {
          toDate.setHours(23, 59, 59, 999);
        }
        query.createdAt.$lte = toDate;
      }
    }

    // Payment range filter
    if (payMin || payMax) {
      query.recruiterProposedPayment = {};
      if (payMin) query.recruiterProposedPayment.$gte = Number(payMin);
      if (payMax) query.recruiterProposedPayment.$lte = Number(payMax);
    }

    // Search: if the term looks like an ObjectId, search by _id as well.
    // Also search recruiter name/email by finding matching profiles first.
    let recruiterUserIdsFromSearch = null;
    if (search) {
      // Find recruiter profiles matching the search term
      const matchingProfiles = await RecruiterProfile.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
        ],
      }).select('userId');
      recruiterUserIdsFromSearch = matchingProfiles.map((p) => p.userId);

      // Also search by recruiter email on User model
      const matchingUsers = await User.find({
        role: ROLES.RECRUITER,
        email: { $regex: search, $options: 'i' },
      }).select('_id');
      const matchingUserIds = matchingUsers.map((u) => u._id);

      // Combine all recruiter ids
      const allRecruiterIds = [...recruiterUserIdsFromSearch, ...matchingUserIds];

      const searchOr = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { eventType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];

      if (allRecruiterIds.length > 0) {
        searchOr.push({ recruiterId: { $in: allRecruiterIds } });
      }

      // Check if search term looks like a MongoDB ObjectId
      if (/^[0-9a-fA-F]{24}$/.test(search.trim())) {
        const mongoose = require('mongoose');
        searchOr.push({ _id: new mongoose.Types.ObjectId(search.trim()) });
      }

      query.$or = searchOr;
    }

    // Sort
    const sortObj = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const totalDocs = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('recruiterId', 'email phone')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Attach recruiter profiles
    const recruiterUserIds = jobs.map((j) => j.recruiterId?._id).filter(Boolean);
    const recruiterProfiles = await RecruiterProfile.find({ userId: { $in: recruiterUserIds } });
    const recruiterMap = new Map(recruiterProfiles.map((p) => [p.userId.toString(), p]));

    const enrichedJobs = jobs.map((j) => {
      const jobObj = j.toObject();
      if (j.recruiterId && recruiterMap.has(j.recruiterId._id.toString())) {
        jobObj.recruiterProfile = recruiterMap.get(j.recruiterId._id.toString());
      }
      return jobObj;
    });

    // Status counts (unfiltered by status, but respecting other filters)
    const baseQuery = { isDeleted: { $ne: true } };
    if (createdFrom || createdTo) {
      baseQuery.createdAt = query.createdAt;
    }
    const statusCounts = {
      ALL: await Job.countDocuments(baseQuery),
      PENDING_REVIEW: await Job.countDocuments({ ...baseQuery, status: JOB_STATUS.PENDING_REVIEW }),
      APPROVED: await Job.countDocuments({ ...baseQuery, acceptedAt: { $ne: null }, status: { $ne: JOB_STATUS.REJECTED } }),
      REJECTED: await Job.countDocuments({ ...baseQuery, status: JOB_STATUS.REJECTED }),
    };

    res.json({
      success: true,
      jobs: enrichedJobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
      },
      statusCounts,
    });
  } catch (error) {
    next(error);
  }
};

// Admin Edit & Approve/Reject Job Request
exports.reviewJobRequest = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const {
      title,
      description,
      eventType,
      eventDate,
      startTime,
      endTime,
      location,
      workersRequired,
      requiredSkills,
      workerRequirements,
      responsibilities,
      adminApprovedPayment,
      action, // 'APPROVE' or 'REJECT'
      adminNotes,
    } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const allowedStatuses = [JOB_STATUS.PENDING_REVIEW, JOB_STATUS.REJECTED, JOB_STATUS.APPROVED, JOB_STATUS.SUSPENDED, JOB_STATUS.COMPLETED];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({ success: false, message: `Cannot review job with status: ${job.status}` });
    }

    const previousValue = {
      title: job.title,
      status: job.status,
      recruiterProposedPayment: job.recruiterProposedPayment,
      adminApprovedPayment: job.adminApprovedPayment,
      // Include immutable snapshot in audit previousValue for full traceability
      offeredAmountPerPerson: job.offeredAmountPerPerson,
      offeredTotalAmount: job.offeredTotalAmount,
      offeredAmountCapturedAt: job.offeredAmountCapturedAt,
    };

    // Update fields if provided by Admin
    if (title) job.title = title;
    if (description) job.description = description;
    if (eventType) job.eventType = eventType;
    if (eventDate) job.eventDate = new Date(eventDate);
    if (startTime) job.startTime = startTime;
    if (endTime) job.endTime = endTime;
    if (location) job.location = location;
    if (workersRequired) job.workersRequired = Number(workersRequired);
    if (requiredSkills) {
      job.requiredSkills = Array.isArray(requiredSkills) ? requiredSkills : requiredSkills.split(',').map((s) => s.trim());
    }
    if (workerRequirements !== undefined) job.workerRequirements = workerRequirements;
    if (responsibilities !== undefined) job.responsibilities = responsibilities;
    if (adminNotes !== undefined) job.adminNotes = adminNotes;
    if (req.body.recruiterPaymentStatus !== undefined) job.recruiterPaymentStatus = req.body.recruiterPaymentStatus;

    // Set Admin Approved Payment (Defaults to proposed payment if not specified)
    job.adminApprovedPayment = adminApprovedPayment !== undefined ? Number(adminApprovedPayment) : (job.adminApprovedPayment || job.recruiterProposedPayment);
    job.reviewedByAdminId = req.user._id;
    job.reviewedAt = new Date();

    const targetAction = action ? action.toUpperCase() : job.status;
    if (targetAction === 'APPROVE' || targetAction === 'APPROVED') {
      job.status = JOB_STATUS.APPROVED;
      // ── Acceptance Proof: permanently record who approved and when ──────────
      if (!job.acceptedAt) {
        job.acceptedAt = new Date();
        job.acceptedByAdminId = req.user._id;
      }

      // ── Recruiter → Admin Payment Record ───────────────────────────────────
      const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(job._id);
      const payableAmount = eligibleCount > 0
        ? totalPayable
        : Number(
            req.body.recruiterPaymentAmount !== undefined
              ? req.body.recruiterPaymentAmount
              : (job.offeredTotalAmount || ((job.offeredAmountPerPerson || job.recruiterProposedPayment || 0) * (job.workersRequired || 1)))
          );
      job.recruiterPaymentAmount = payableAmount;

      const targetPaymentStatus = req.body.recruiterPaymentStatus || job.recruiterPaymentStatus;

      let recPayment = await RecruiterPayment.findOne({ jobId: job._id });
      if (!recPayment) {
        recPayment = await RecruiterPayment.create({
          recruiterId: job.recruiterId,
          jobId: job._id,
          amount: payableAmount,
          perPersonRate,
          verifiedAttendeesCount: eligibleCount,
          status: targetPaymentStatus || 'PENDING',
        });
        job.recruiterPaymentStatus = recPayment.status;
      } else {
        if (req.body.recruiterPaymentStatus && req.body.recruiterPaymentStatus !== recPayment.status) {
          recPayment.status = req.body.recruiterPaymentStatus;
        }
        if (recPayment.status === 'PENDING') {
          recPayment.amount = payableAmount;
          recPayment.perPersonRate = perPersonRate;
          recPayment.verifiedAttendeesCount = eligibleCount;
        }
        await recPayment.save();
        // Preserve actual recruiter payment status
        job.recruiterPaymentStatus = recPayment.status;
      }

      // Increment recruiter approved count only if it wasn't already approved
      if (previousValue.status !== JOB_STATUS.APPROVED && previousValue.status !== JOB_STATUS.COMPLETED) {
        await RecruiterProfile.findOneAndUpdate(
          { userId: job.recruiterId },
          { $inc: { approvedJobsCount: 1 } }
        );
      }
    } else if (targetAction === 'REJECT' || targetAction === 'REJECTED') {
      job.status = JOB_STATUS.REJECTED;
      // We no longer clear acceptedAt to preserve the event's history if it was already approved
      // Decrement count if it was previously approved
      if (previousValue.status === JOB_STATUS.APPROVED || previousValue.status === JOB_STATUS.COMPLETED) {
        await RecruiterProfile.findOneAndUpdate(
          { userId: job.recruiterId },
          { $inc: { approvedJobsCount: -1 } }
        );
      }
    } else if (targetAction === 'SUSPEND' || targetAction === 'SUSPENDED') {
      job.status = JOB_STATUS.SUSPENDED;
      if (previousValue.status === JOB_STATUS.APPROVED || previousValue.status === JOB_STATUS.COMPLETED) {
        await RecruiterProfile.findOneAndUpdate(
          { userId: job.recruiterId },
          { $inc: { approvedJobsCount: -1 } }
        );
      }
    } else if (targetAction === 'COMPLETE' || targetAction === 'COMPLETED') {
      job.status = JOB_STATUS.COMPLETED;
      if (!job.completedAt) {
        job.completedAt = new Date();
        job.completedByAdminId = req.user._id;
      }
      if (previousValue.status !== JOB_STATUS.APPROVED && previousValue.status !== JOB_STATUS.COMPLETED) {
        await RecruiterProfile.findOneAndUpdate(
          { userId: job.recruiterId },
          { $inc: { approvedJobsCount: 1 } }
        );
      }
    }

    await job.save();

    // ── Populate admin user name for richer audit/notification messages ──────
    const adminUser = await require('../models/User').findById(req.user._id).select('email');
    const adminEmail = adminUser?.email || 'Admin';

    // Resolve recruiter name for audit subject
    const recruiterProfile = await RecruiterProfile.findOne({ userId: job.recruiterId });
    const recruiterName = recruiterProfile?.fullName || '';

    // ── Audit log ────────────────────────────────────────────────────────────
    let auditAction = 'STATUS_CHANGED';
    let auditNotes = `Admin (${adminEmail}) updated job status to ${job.status}.`;
    let notifTitle = 'Job Status Updated';
    let notifMessage = `Your job request '${job.title}' status was updated to ${job.status}.`;
    let notifType = 'JOB_UPDATED';

    if (targetAction === 'APPROVE' || targetAction === 'APPROVED') {
      auditAction = 'REQUEST_ACCEPTED';
      auditNotes = `Admin (${adminEmail}) accepted job request. Recruiter's original offer: ₹${job.offeredAmountPerPerson}/person × ${job.workersRequired} workers = ₹${job.offeredTotalAmount} total. Admin-approved payment set to ₹${job.adminApprovedPayment}.`;
      notifTitle = 'Job Request Approved ✅';
      notifMessage = `Your job request '${job.title}' has been approved by Admin. It is now open for worker applications.`;
      notifType = 'JOB_APPROVED';
    } else if (targetAction === 'REJECT' || targetAction === 'REJECTED') {
      auditAction = 'REQUEST_REJECTED';
      auditNotes = `Admin (${adminEmail}) rejected job request. Reason: ${adminNotes || 'N/A'}. Recruiter's original offer was: ₹${job.offeredAmountPerPerson}/person × ${job.workersRequired} workers = ₹${job.offeredTotalAmount} total.`;
      notifTitle = 'Job Request Rejected';
      notifMessage = `Your job request '${job.title}' was rejected by Admin. Reason: ${adminNotes || 'N/A'}`;
      notifType = 'JOB_REJECTED';
    } else if (targetAction === 'SUSPEND' || targetAction === 'SUSPENDED') {
      auditAction = 'JOB_SUSPENDED';
      auditNotes = `Admin (${adminEmail}) suspended job. Reason: ${adminNotes || 'N/A'}.`;
      notifTitle = 'Job Suspended ⚠️';
      notifMessage = `Your job request '${job.title}' has been suspended by Admin. Reason: ${adminNotes || 'N/A'}`;
      notifType = 'JOB_SUSPENDED';
    } else if (targetAction === 'COMPLETE' || targetAction === 'COMPLETED') {
      auditAction = 'JOB_COMPLETED';
      auditNotes = `Admin (${adminEmail}) marked job as completed. Notes: ${adminNotes || 'N/A'}.`;
      notifTitle = 'Job Completed 🏆';
      notifMessage = `Your job '${job.title}' has been marked as completed by Admin.`;
      notifType = 'JOB_COMPLETED';
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: auditAction,
      entityName: 'Job',
      entityId: job._id,
      previousValue,
      newValue: {
        status: job.status,
        adminApprovedPayment: job.adminApprovedPayment,
        acceptedAt: job.acceptedAt,
        acceptedByAdminEmail: adminEmail,
        rejectionReason: targetAction === 'REJECT' || targetAction === 'REJECTED' ? (adminNotes || 'No reason provided') : undefined,
        adminNotes: adminNotes,
        reviewedAt: job.reviewedAt,
        // Original immutable offer proof
        offeredAmountPerPerson: job.offeredAmountPerPerson,
        offeredTotalAmount: job.offeredTotalAmount,
        offeredAmountCapturedAt: job.offeredAmountCapturedAt,
      },
      notes: auditNotes,
      subjectName: recruiterName,
      subjectRole: 'RECRUITER',
    });

    // ── Notify Recruiter ─────────────────────────────────────────────────────
    await createNotification({
      userId: job.recruiterId,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      link: `/recruiter/submitted-events/${job._id}`,
    });

    res.json({
      success: true,
      message: `Job status updated to ${job.status} successfully.`,
      job,
    });
  } catch (error) {
    next(error);
  }
};

// Application Management Queue
exports.getApplications = async (req, res, next) => {
  try {
    const { jobId, status = 'ALL', page, limit } = req.query;

    // Always exclude soft-deleted applications from the active list
    const query = { isDeleted: { $ne: true } };
    if (jobId) query.jobId = jobId;
    if (status !== 'ALL') query.status = status;

    const totalDocs = await Application.countDocuments(query);
    const hasPagination = page !== undefined || limit !== undefined;
    const parsedLimit = Number(limit) || 10;
    const parsedPage = Number(page) || 1;

    let appQuery = Application.find(query)
      .populate('jobId')
      .populate('workerId', 'email phone')
      .sort({ createdAt: -1 });

    if (hasPagination) {
      appQuery = appQuery.skip((parsedPage - 1) * parsedLimit).limit(parsedLimit);
    }
    const applications = await appQuery;

    // Populate worker profiles
    const workerUserIds = applications.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enrichedApplications = applications.map((app) => {
      const appObj = app.toObject();
      if (app.workerId && workerMap.has(app.workerId._id.toString())) {
        appObj.workerProfile = workerMap.get(app.workerId._id.toString());
      }
      return appObj;
    });

    res.json({
      success: true,
      applications: enrichedApplications,
      pagination: {
        page: hasPagination ? parsedPage : 1,
        limit: hasPagination ? parsedLimit : totalDocs,
        totalDocs,
        totalPages: hasPagination ? Math.ceil(totalDocs / parsedLimit) : 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Application Trash Lifecycle ────────────────────────────────────────────

// Soft-delete an Application — moves it to Trash for 30 days
exports.softDeleteApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (application.isDeleted) return res.status(400).json({ success: false, message: 'Already in trash.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    application.isDeleted = true;
    application.deletedAt = now;
    application.permanentDeleteAt = permanentDeleteAt;
    await application.save();

    res.json({ success: true, message: 'Application moved to trash.', application });
  } catch (error) {
    next(error);
  }
};

// Get Trash — all soft-deleted Application records
exports.getTrashApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ isDeleted: true })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone')
      .sort({ deletedAt: -1 });

    const workerUserIds = applications.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = applications.map((app) => {
      const appObj = app.toObject();
      if (app.workerId && workerMap.has(app.workerId._id.toString())) {
        appObj.workerProfile = workerMap.get(app.workerId._id.toString());
      }
      return appObj;
    });

    res.json({ success: true, applications: enriched });
  } catch (error) {
    next(error);
  }
};

// Restore an Application from Trash
exports.restoreApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (!application.isDeleted) return res.status(400).json({ success: false, message: 'Application is not in trash.' });

    application.isDeleted = false;
    application.deletedAt = null;
    application.permanentDeleteAt = null;
    await application.save();

    if (application.status === APPLICATION_STATUS.APPROVED) {
      await syncSingleApprovedApplication(application, req.user._id, '', true);
    }

    res.json({ success: true, message: 'Application restored successfully.', application });
  } catch (error) {
    next(error);
  }
};

// Permanently delete one Application (Admin explicit action from Trash)
exports.permanentDeleteApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (!application.isDeleted) {
      return res.status(400).json({ success: false, message: 'Application must be in trash before permanent deletion.' });
    }

    await Application.deleteOne({ _id: id });
    res.json({ success: true, message: 'Application permanently deleted.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to ensure an approved application has its corresponding
 * Assignment and Attendance records created and synchronized.
 * Idempotent: will not create duplicates if records already exist.
 */
async function syncSingleApprovedApplication(application, adminUserId, adminNotes = '', restoreDeleted = false) {
  if (!application || application.status !== APPLICATION_STATUS.APPROVED || application.isDeleted) {
    return null;
  }

  const rawJobId = application.jobId?._id || application.jobId;
  const job = await Job.findById(rawJobId);
  if (!job || job.isDeleted) return null;

  // Check worker eligibility
  const worker = await User.findById(application.workerId);
  if (!worker || worker.isDeleted || worker.status === 'DELETED') return null;

  // 1. Find or create Assignment
  let assignment = await Assignment.findOne({ jobId: job._id, workerId: application.workerId });
  if (!assignment) {
    assignment = await Assignment.create({
      jobId: job._id,
      workerId: application.workerId,
      applicationId: application._id,
      status: ASSIGNMENT_STATUS.ASSIGNED,
      assignedByAdminId: adminUserId || application.reviewedByAdminId || worker._id,
      notes: adminNotes || application.adminNotes || '',
    });

    await WorkerProfile.findOneAndUpdate(
      { userId: application.workerId },
      { $inc: { totalAssignments: 1 } }
    );
  }

  // 2. Find or create Attendance
  let attendance = await Attendance.findOne({ assignmentId: assignment._id });
  if (!attendance) {
    attendance = await Attendance.create({
      assignmentId: assignment._id,
      jobId: job._id,
      workerId: application.workerId,
      date: job.eventDate || new Date(),
      status: ATTENDANCE_STATUS.PENDING,
    });
  }

  // 3. Keep job assignedWorkersCount in sync
  const activeCount = await Assignment.countDocuments({
    jobId: job._id,
    isDeleted: { $ne: true },
    status: { $in: [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.CONFIRMED, ASSIGNMENT_STATUS.IN_PROGRESS, ASSIGNMENT_STATUS.COMPLETED] },
  });
  if (job.assignedWorkersCount !== activeCount) {
    job.assignedWorkersCount = activeCount;
    await job.save();
  }

  return { assignment, attendance };
}

/**
 * Synchronize attendance and assignments for all active approved applications.
 * Can be called during attendance list retrieval or application queue retrieval.
 */
async function syncAllApprovedApplications(jobId = null) {
  try {
    const query = {
      status: APPLICATION_STATUS.APPROVED,
      isDeleted: { $ne: true },
    };
    if (jobId) query.jobId = jobId;

    const approvedApps = await Application.find(query);
    for (const app of approvedApps) {
      await syncSingleApprovedApplication(app, app.reviewedByAdminId);
    }
  } catch (err) {
    console.error('Error during approved applications attendance sync:', err);
  }
}

// Approve Application and Assign Worker to Job
exports.approveAndAssignWorker = async (req, res, next) => {
  try {
    const { applicationId, adminNotes, allowOverAssignment } = req.body;

    const application = await Application.findById(applicationId).populate('jobId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const job = await Job.findById(application.jobId._id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Associated job not found' });
    }

    // Over-assignment check
    if (job.assignedWorkersCount >= job.workersRequired && !allowOverAssignment) {
      return res.status(400).json({
        success: false,
        message: `Job already has required ${job.workersRequired} worker(s) assigned. Set allowOverAssignment to override.`,
      });
    }

    // Worker availability conflict check
    const existingAssignments = await Assignment.find({ 
      workerId: application.workerId,
      status: { $in: ['ASSIGNED', 'COMPLETED'] }
    }).populate('jobId', 'eventDate');

    const hasConflict = existingAssignments.some(a => {
      if (!a.jobId) return false;
      const existingDate = new Date(a.jobId.eventDate).setHours(0, 0, 0, 0);
      const newDate = new Date(job.eventDate).setHours(0, 0, 0, 0);
      return existingDate === newDate;
    });

    if (hasConflict && !allowOverAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Worker already has an assignment on this date. Set allowOverAssignment to override.',
      });
    }

    // Update application status
    application.status = APPLICATION_STATUS.APPROVED;
    application.adminNotes = adminNotes || '';
    application.reviewedByAdminId = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Create assignment if not existing
    let assignment = await Assignment.findOne({ jobId: job._id, workerId: application.workerId });
    if (!assignment) {
      assignment = await Assignment.create({
        jobId: job._id,
        workerId: application.workerId,
        applicationId: application._id,
        status: ASSIGNMENT_STATUS.ASSIGNED,
        assignedByAdminId: req.user._id,
        notes: adminNotes || '',
      });

      // Increment job assigned count
      job.assignedWorkersCount += 1;
      await job.save();

      // Increment worker total assignments
      await WorkerProfile.findOneAndUpdate(
        { userId: application.workerId },
        { $inc: { totalAssignments: 1 } }
      );
    }

    // Initialize attendance record for event date
    const existingAttendance = await Attendance.findOne({ assignmentId: assignment._id });
    if (!existingAttendance) {
      await Attendance.create({
        assignmentId: assignment._id,
        jobId: job._id,
        workerId: application.workerId,
        date: job.eventDate,
        status: ATTENDANCE_STATUS.PENDING,
      });
    }

    // Audit log — resolve worker name for subject
    const assignedWorkerProfile = await WorkerProfile.findOne({ userId: application.workerId });
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'ASSIGN_WORKER',
      entityName: 'Assignment',
      entityId: assignment._id,
      notes: `Admin assigned worker to job '${job.title}'`,
      subjectName: assignedWorkerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    // Notify Worker
    await createNotification({
      userId: application.workerId,
      title: 'Assignment Confirmed!',
      message: `Congratulations! You have been assigned to event '${job.title}' on ${new Date(job.eventDate).toLocaleDateString()}. Final pay: ₹${job.adminApprovedPayment}.`,
      type: 'ASSIGNMENT_CREATED',
      link: '/worker/assignments',
    });

    res.json({
      success: true,
      message: 'Worker application approved and assigned to event successfully.',
      assignment,
    });
  } catch (error) {
    next(error);
  }
};

// Admin Reject Application
exports.rejectApplication = async (req, res, next) => {
  try {
    const { applicationId, adminNotes } = req.body;

    const application = await Application.findById(applicationId).populate('jobId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    application.status = APPLICATION_STATUS.REJECTED;
    application.adminNotes = adminNotes || '';
    application.reviewedByAdminId = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    const rejectedWorkerProfile = await WorkerProfile.findOne({ userId: application.workerId });
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'REJECT_APPLICATION',
      entityName: 'Application',
      entityId: application._id,
      notes: `Admin rejected worker application`,
      subjectName: rejectedWorkerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    await createNotification({
      userId: application.workerId,
      title: 'Application Status Update',
      message: `Your application for '${application.jobId.title}' was not selected by Admin.`,
      type: 'APPLICATION_REJECTED',
      link: '/worker/applications',
    });

    res.json({ success: true, message: 'Application rejected.', application });
  } catch (error) {
    next(error);
  }
};

// Attendance Management
exports.getAttendanceList = async (req, res, next) => {
  try {
    const { jobId, status, date, startDate, endDate, preset } = req.query;

    // Self-healing synchronization: ensure all active approved applications have an attendance record
    await syncAllApprovedApplications(jobId);

    const query = { isDeleted: { $ne: true } };
    if (jobId) query.jobId = jobId;
    if (status && status !== 'ALL') query.status = status;

    // Date filtering (Asia/Kolkata timezone: UTC+05:30)
    const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const getKolkataDateParts = (d = new Date()) => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.format(d).split('-');
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10) - 1,
        date: parseInt(parts[2], 10),
      };
    };

    if (preset === 'today') {
      const { year, month, date: d } = getKolkataDateParts(new Date());
      const startMs = Date.UTC(year, month, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      const nextDayStartMs = Date.UTC(year, month, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
    } else if (preset === 'yesterday') {
      const { year, month, date: d } = getKolkataDateParts(new Date());
      const startMs = Date.UTC(year, month, d - 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      const nextDayStartMs = Date.UTC(year, month, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
    } else if (date) {
      const trimmed = String(date).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
        const nextDayStartMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
        query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
      }
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const trimmed = String(startDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const [y, m, d] = trimmed.split('-').map(Number);
          const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
          query.date.$gte = new Date(startMs);
        } else {
          query.date.$gte = new Date(startDate);
        }
      }
      if (endDate) {
        const trimmed = String(endDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const [y, m, d] = trimmed.split('-').map(Number);
          const nextDayStartMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
          query.date.$lt = new Date(nextDayStartMs);
        } else {
          query.date.$lte = new Date(endDate);
        }
      }
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('jobId', 'title eventType eventDate location adminApprovedPayment offeredAmountPerPerson recruiterProposedPayment')
      .populate('workerId', 'email phone')
      .sort({ date: -1 });

    const workerUserIds = attendanceRecords.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = attendanceRecords.map((rec) => {
      const recObj = rec.toObject();
      if (rec.workerId && workerMap.has(rec.workerId._id.toString())) {
        recObj.workerProfile = workerMap.get(rec.workerId._id.toString());
      }
      recObj.eventDate = recObj.date || recObj.jobId?.eventDate;
      return recObj;
    });

    res.json({ success: true, attendance: enriched });
  } catch (error) {
    next(error);
  }
};

// Update Attendance Status
exports.updateAttendance = async (req, res, next) => {
  try {
    const { attendanceId, status, checkInTime, checkOutTime, isOvernightShift, notes } = req.body;

    if (!attendanceId) {
      return res.status(400).json({ success: false, message: 'Attendance ID is required.' });
    }

    const record = await Attendance.findById(attendanceId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    // 1. Validate status against valid constants
    const validStatuses = Object.values(ATTENDANCE_STATUS);
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance status.' });
    }

    // 2. Validate time format: strictly 24-hour HH:mm or empty
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    let sanitizedCheckIn = '';
    if (checkInTime !== undefined && checkInTime !== null && checkInTime !== '') {
      if (typeof checkInTime !== 'string' || !timeRegex.test(checkInTime.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Check-in time must be in valid 24-hour format (HH:mm).',
        });
      }
      sanitizedCheckIn = checkInTime.trim();
    }

    let sanitizedCheckOut = '';
    if (checkOutTime !== undefined && checkOutTime !== null && checkOutTime !== '') {
      if (typeof checkOutTime !== 'string' || !timeRegex.test(checkOutTime.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time must be in valid 24-hour format (HH:mm).',
        });
      }
      sanitizedCheckOut = checkOutTime.trim();
    }

    // 3. Chronological validation when both times are provided
    if (sanitizedCheckIn && sanitizedCheckOut && !isOvernightShift) {
      if (sanitizedCheckOut <= sanitizedCheckIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time cannot be earlier than or equal to check-in time for same-day shifts.',
        });
      }
    }

    const previousValue = record.status;
    if (status) record.status = status;
    record.checkInTime = sanitizedCheckIn;
    record.checkOutTime = sanitizedCheckOut;
    if (isOvernightShift !== undefined) {
      record.isOvernightShift = Boolean(isOvernightShift);
    }
    if (notes !== undefined) record.notes = notes;
    record.verifiedByAdminId = req.user._id;

    await record.save();

    // Synchronize pre-submission Recruiter Payment if attendance is verified or updated
    try {
      const pendingPayment = await RecruiterPayment.findOne({ jobId: record.jobId, isDeleted: { $ne: true } });
      if (pendingPayment && pendingPayment.status === 'PENDING') {
        const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(record.jobId);
        pendingPayment.amount = totalPayable;
        pendingPayment.perPersonRate = perPersonRate;
        pendingPayment.verifiedAttendeesCount = eligibleCount;
        await pendingPayment.save();

        await Job.findByIdAndUpdate(record.jobId, {
          recruiterPaymentAmount: totalPayable,
        });
      }
    } catch (syncErr) {
      console.error('Error synchronizing recruiter payment calculation on attendance update:', syncErr);
    }

    // Synchronize event completion & payment logic if attendance is changed retroactively
    if (previousValue !== status) {
      const assignment = await Assignment.findById(record.assignmentId);
      if (assignment) {
        const job = await Job.findById(assignment.jobId);
        if (job && job.status === JOB_STATUS.COMPLETED) {
          const wasAbsent = previousValue === ATTENDANCE_STATUS.ABSENT;
          const isAbsent = status === ATTENDANCE_STATUS.ABSENT;

          // Case C: ABSENT -> PRESENT (or any non-absent)
          if (wasAbsent && !isAbsent) {
            assignment.status = ASSIGNMENT_STATUS.COMPLETED;
            await assignment.save();

            await WorkerProfile.findOneAndUpdate(
              { userId: assignment.workerId },
              { $inc: { completedEventsCount: 1 } }
            );

            let payment = await Payment.findOne({ assignmentId: assignment._id });
            if (!payment) {
              const expectedDate = new Date();
              expectedDate.setDate(expectedDate.getDate() + 12);
              const workerPayout = Number(
                assignment.paymentSettlement?.amount ||
                job.adminApprovedPayment ||
                job.offeredAmountPerPerson ||
                job.recruiterProposedPayment ||
                0
              );
              payment = await Payment.create({
                assignmentId: assignment._id,
                jobId: job._id,
                workerId: assignment.workerId,
                amount: workerPayout,
                status: PAYMENT_STATUS.PENDING,
                expectedPaymentDate: expectedDate,
                paymentTimelineText: 'Payout processing scheduled within 10–15 days after event completion.',
              });

              await createNotification({
                userId: assignment.workerId,
                title: 'Payment Eligibility Restored',
                message: `Your attendance for '${job.title}' was updated. Payment of ₹${workerPayout} is now in processing.`,
                type: 'PAYMENT_RESTORED',
                link: '/worker/payments',
              });
            }

            await logAuditEvent({
              performedByUserId: req.user._id,
              performedByRole: ROLES.ADMIN,
              action: 'ATTENDANCE_SYNC_PAYMENT_CREATED',
              entityName: 'Payment',
              entityId: payment._id,
              previousValue: ATTENDANCE_STATUS.ABSENT,
              newValue: status,
              notes: `Attendance changed ABSENT→${status} after event completion. Payment record created/restored for '${job.title}'.`,
            });
          }
          // Case D: PRESENT (or non-absent) -> ABSENT
          else if (!wasAbsent && isAbsent) {
            assignment.status = ASSIGNMENT_STATUS.ASSIGNED;
            await assignment.save();

            await WorkerProfile.findOneAndUpdate(
              { userId: assignment.workerId },
              { $inc: { completedEventsCount: -1 } }
            );

            // Only revoke payment if it has not already been processed or paid
            const existingPayment = await Payment.findOne({ assignmentId: assignment._id });
            if (existingPayment && existingPayment.status === PAYMENT_STATUS.PENDING) {
              await Payment.deleteOne({ _id: existingPayment._id });

              await logAuditEvent({
                performedByUserId: req.user._id,
                performedByRole: ROLES.ADMIN,
                action: 'ATTENDANCE_SYNC_PAYMENT_REVOKED',
                entityName: 'Payment',
                entityId: existingPayment._id,
                previousValue: previousValue,
                newValue: ATTENDANCE_STATUS.ABSENT,
                notes: `Attendance changed ${previousValue}→ABSENT after event completion. Pending payment revoked for '${job.title}'.`,
              });
            }
          }
        }
      }
    }

    // Resolve worker name for audit subject
    const attendanceWorkerProfile = await WorkerProfile.findOne({ userId: record.workerId });
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'UPDATE_ATTENDANCE',
      entityName: 'Attendance',
      entityId: record._id,
      previousValue,
      newValue: status,
      notes: `Admin marked attendance as ${status}`,
      subjectName: attendanceWorkerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    await createNotification({
      userId: record.workerId,
      title: 'Attendance Marked',
      message: `Admin marked your attendance status as '${status}' for event.`,
      type: 'ATTENDANCE_UPDATED',
      link: '/worker/attendance',
    });

    res.json({ success: true, message: 'Attendance updated successfully', record });
  } catch (error) {
    next(error);
  }
};

// ── Attendance Trash Lifecycle ────────────────────────────────────────────

// Soft-delete an Attendance record → Trash
exports.softDeleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    if (record.isDeleted) return res.status(400).json({ success: false, message: 'Already in trash.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    record.isDeleted = true;
    record.deletedAt = now;
    record.permanentDeleteAt = permanentDeleteAt;
    await record.save();

    res.json({ success: true, message: 'Attendance record moved to trash.', record });
  } catch (error) {
    next(error);
  }
};

// Get Trash — all soft-deleted Attendance records
exports.getTrashAttendance = async (req, res, next) => {
  try {
    const { jobId, status, date, startDate, endDate, preset } = req.query;

    const query = { isDeleted: true };
    if (jobId) query.jobId = jobId;
    if (status && status !== 'ALL') query.status = status;

    // Date filtering (Asia/Kolkata timezone: UTC+05:30)
    const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const getKolkataDateParts = (d = new Date()) => {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.format(d).split('-');
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10) - 1,
        date: parseInt(parts[2], 10),
      };
    };

    if (preset === 'today') {
      const { year, month, date: d } = getKolkataDateParts(new Date());
      const startMs = Date.UTC(year, month, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      const nextDayStartMs = Date.UTC(year, month, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
    } else if (preset === 'yesterday') {
      const { year, month, date: d } = getKolkataDateParts(new Date());
      const startMs = Date.UTC(year, month, d - 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      const nextDayStartMs = Date.UTC(year, month, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
      query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
    } else if (date) {
      const trimmed = String(date).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
        const nextDayStartMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
        query.date = { $gte: new Date(startMs), $lt: new Date(nextDayStartMs) };
      }
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const trimmed = String(startDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const [y, m, d] = trimmed.split('-').map(Number);
          const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
          query.date.$gte = new Date(startMs);
        } else {
          query.date.$gte = new Date(startDate);
        }
      }
      if (endDate) {
        const trimmed = String(endDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          const [y, m, d] = trimmed.split('-').map(Number);
          const nextDayStartMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - KOLKATA_OFFSET_MS;
          query.date.$lt = new Date(nextDayStartMs);
        } else {
          query.date.$lte = new Date(endDate);
        }
      }
    }

    const records = await Attendance.find(query)
      .populate('jobId', 'title eventType eventDate location adminApprovedPayment offeredAmountPerPerson recruiterProposedPayment')
      .populate('workerId', 'email phone')
      .sort({ deletedAt: -1 });

    const workerUserIds = records.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = records.map((rec) => {
      const recObj = rec.toObject();
      if (rec.workerId && workerMap.has(rec.workerId._id.toString())) {
        recObj.workerProfile = workerMap.get(rec.workerId._id.toString());
      }
      recObj.eventDate = recObj.date || recObj.jobId?.eventDate;
      return recObj;
    });

    res.json({ success: true, attendance: enriched });
  } catch (error) {
    next(error);
  }
};

// Restore an Attendance record from Trash
exports.restoreAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    if (!record.isDeleted) return res.status(400).json({ success: false, message: 'Attendance record is not in trash.' });

    record.isDeleted = false;
    record.deletedAt = null;
    record.permanentDeleteAt = null;
    await record.save();

    res.json({ success: true, message: 'Attendance record restored successfully.', record });
  } catch (error) {
    next(error);
  }
};

// Permanently delete one Attendance record (Admin explicit action from Trash)
exports.permanentDeleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    if (!record.isDeleted) {
      return res.status(400).json({ success: false, message: 'Attendance record must be in trash before permanent deletion.' });
    }

    await Attendance.deleteOne({ _id: id });
    res.json({ success: true, message: 'Attendance record permanently deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── Job Trash Lifecycle ────────────────────────────────────────────

exports.softDeleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    if (job.isDeleted) return res.status(400).json({ success: false, message: 'Already in trash.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    job.isDeleted = true;
    job.deletedAt = now;
    job.permanentDeleteAt = permanentDeleteAt;
    await job.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'SOFT_DELETE_JOB',
      entityName: 'Job',
      entityId: job._id,
      notes: `Admin moved job '${job.title}' to trash.`,
    });

    res.json({ success: true, message: 'Job moved to trash.', job });
  } catch (error) {
    next(error);
  }
};

exports.getTrashJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ isDeleted: true })
      .populate('recruiterId', 'email phone')
      .sort({ deletedAt: -1 });

    const recruiterUserIds = jobs.map((j) => j.recruiterId?._id).filter(Boolean);
    const recruiterProfiles = await RecruiterProfile.find({ userId: { $in: recruiterUserIds } });
    const recruiterMap = new Map(recruiterProfiles.map((p) => [p.userId.toString(), p]));

    const enrichedJobs = jobs.map((j) => {
      const jobObj = j.toObject();
      if (j.recruiterId && recruiterMap.has(j.recruiterId._id.toString())) {
        jobObj.recruiterProfile = recruiterMap.get(j.recruiterId._id.toString());
      }
      return jobObj;
    });

    res.json({ success: true, jobs: enrichedJobs });
  } catch (error) {
    next(error);
  }
};

exports.restoreJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    if (!job.isDeleted) return res.status(400).json({ success: false, message: 'Job is not in trash.' });

    job.isDeleted = false;
    job.deletedAt = null;
    job.permanentDeleteAt = null;
    await job.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RESTORE_JOB',
      entityName: 'Job',
      entityId: job._id,
      notes: `Admin restored job '${job.title}' from trash.`,
    });

    res.json({ success: true, message: 'Job restored successfully.', job });
  } catch (error) {
    next(error);
  }
};

exports.permanentDeleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    if (!job.isDeleted) {
      return res.status(400).json({ success: false, message: 'Job must be in trash before permanent deletion.' });
    }

    await Job.deleteOne({ _id: id });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PERMANENT_DELETE_JOB',
      entityName: 'Job',
      entityId: job._id,
      notes: `Admin permanently deleted job '${job.title}'.`,
    });

    res.json({ success: true, message: 'Job permanently deleted.' });
  } catch (error) {
    next(error);
  }
};

// Event Completion & Payment Initialization (10-15 Day Timeline)
exports.completeEvent = async (req, res, next) => {
  try {
    const jobId = req.params.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Idempotency: If already completed, return success safely without duplicate side effects
    if (job.status === JOB_STATUS.COMPLETED) {
      return res.json({
        success: true,
        message: 'Event is already marked as completed.',
        job,
      });
    }

    // Eligibility check: Only APPROVED events can be marked completed
    if (job.status !== JOB_STATUS.APPROVED) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete event with status '${job.status}'. Only APPROVED events can be marked completed.`,
      });
    }

    job.status = JOB_STATUS.COMPLETED;
    job.completedAt = new Date();
    job.completedByAdminId = req.user._id;
    if (req.body.adminNotes) {
      job.adminNotes = req.body.adminNotes;
    }
    await job.save();

    // Get all assignments for job
    const assignments = await Assignment.find({ jobId: job._id, status: { $ne: ASSIGNMENT_STATUS.CANCELLED } });

    // Calculate expected payment date (10-15 days from now)
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 12); // Default midpoint 12 days

    let paymentsCreated = 0;

    for (const assign of assignments) {
      // Check attendance: find active attendance record for this assignment
      let attendance = await Attendance.findOne({
        assignmentId: assign._id,
        isDeleted: { $ne: true },
      });

      // If marked explicitly as ABSENT, this worker was absent and is not eligible for payout
      if (attendance && attendance.status === ATTENDANCE_STATUS.ABSENT) {
        continue;
      }

      // If attendance was PENDING or unverified, completing the event verifies their attendance as PRESENT
      if (!attendance) {
        attendance = await Attendance.create({
          assignmentId: assign._id,
          jobId: job._id,
          workerId: assign.workerId,
          date: job.eventDate,
          status: ATTENDANCE_STATUS.PRESENT,
          verifiedByAdminId: req.user._id,
          verifiedAt: new Date(),
        });
      } else if (attendance.status === ATTENDANCE_STATUS.PENDING || !attendance.verifiedByAdminId) {
        attendance.status = ATTENDANCE_STATUS.PRESENT;
        attendance.verifiedByAdminId = req.user._id;
        attendance.verifiedAt = new Date();
        await attendance.save();
      }

      if (attendance && attendance.status === ATTENDANCE_STATUS.PRESENT) {
        const wasAlreadyCompleted = assign.status === ASSIGNMENT_STATUS.COMPLETED;
        assign.status = ASSIGNMENT_STATUS.COMPLETED;
        assign.verifiedByAdminId = req.user._id;
        await assign.save();

        // Increment worker completed events count only if not already counted
        if (!wasAlreadyCompleted) {
          await WorkerProfile.findOneAndUpdate(
            { userId: assign.workerId },
            { $inc: { completedEventsCount: 1 } }
          );
        }

        let payment = await Payment.findOne({ assignmentId: assign._id });
        if (!payment) {
          const workerPayout = Number(
            assign.paymentSettlement?.amount ||
            job.adminApprovedPayment ||
            job.offeredAmountPerPerson ||
            job.recruiterProposedPayment ||
            0
          );
          payment = await Payment.create({
            assignmentId: assign._id,
            jobId: job._id,
            workerId: assign.workerId,
            amount: workerPayout,
            status: PAYMENT_STATUS.PENDING,
            expectedPaymentDate: expectedDate,
            paymentTimelineText: 'Payout processing scheduled within 10–15 days after event completion.',
          });
          paymentsCreated += 1;

          // Notify Worker once when payment is generated
          await createNotification({
            userId: assign.workerId,
            title: 'Event Completed!',
            message: `Event '${job.title}' marked COMPLETED by Admin. Payment of ₹${workerPayout} is in processing (expected 10–15 days).`,
            type: 'EVENT_COMPLETED',
            link: '/worker/payments',
          });
        }
      }
    }

    // Synchronize pre-submission Recruiter Payment upon event completion
    try {
      const { eligibleCount, totalPayable, perPersonRate } = await calculateAttendancePayable(job._id);
      const pendingPayment = await RecruiterPayment.findOne({ jobId: job._id, isDeleted: { $ne: true } });
      if (pendingPayment && pendingPayment.status === 'PENDING') {
        pendingPayment.amount = totalPayable;
        pendingPayment.perPersonRate = perPersonRate;
        pendingPayment.verifiedAttendeesCount = eligibleCount;
        await pendingPayment.save();

        job.recruiterPaymentAmount = totalPayable;
        await job.save();
      }
    } catch (syncErr) {
      console.error('Error synchronizing recruiter payment calculation on completeEvent:', syncErr);
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'COMPLETE_EVENT',
      entityName: 'Job',
      entityId: job._id,
      notes: `Admin marked event '${job.title}' completed. Created ${paymentsCreated} pending payment records.`,
    });

    res.json({
      success: true,
      message: `Event completed successfully. ${paymentsCreated} worker payment records created with 10–15 day target payout timeline.`,
      job,
    });
  } catch (error) {
    next(error);
  }
};

// Reopen Event / Mark Not Completed by Admin
exports.reopenEvent = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const { adminNotes } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: `Cannot reopen event with status '${job.status}'. Only COMPLETED events can be reopened.`,
      });
    }

    const previousCompletionDate = job.completedAt;
    job.status = JOB_STATUS.APPROVED;
    job.completedAt = null;
    job.completedByAdminId = null;
    if (adminNotes !== undefined) {
      job.adminNotes = adminNotes;
    }
    await job.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'REOPEN_EVENT',
      entityName: 'Job',
      entityId: job._id,
      notes: `Admin reopened event '${job.title}' back to APPROVED/Active status. Previous completion: ${previousCompletionDate ? previousCompletionDate.toISOString() : 'N/A'}. Reason: ${adminNotes || 'None provided'}.`,
    });

    res.json({
      success: true,
      message: `Event '${job.title}' has been reopened and returned to Active Events.`,
      job,
    });
  } catch (error) {
    next(error);
  }
};

// Payment Management
exports.getPayments = async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 10 } = req.query;

    // CRITICAL: only return active (non-deleted) payment records
    const query = { isDeleted: { $ne: true } };
    if (status !== 'ALL') query.status = status;

    const totalDocs = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const workerUserIds = payments.map((p) => p.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = payments.map((p) => {
      const pObj = p.toObject();
      if (p.workerId && workerMap.has(p.workerId._id.toString())) {
        pObj.workerProfile = workerMap.get(p.workerId._id.toString());
      }
      return pObj;
    });

    res.json({
      success: true,
      payments: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Soft-delete a payment record (moves to Trash).
// CRITICAL: Does NOT modify payment.status — completed payments remain PAID.
exports.softDeletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id).populate('jobId', 'title');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    if (payment.isDeleted) return res.status(400).json({ success: false, message: 'Payment is already in trash.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // ONLY touch trash lifecycle fields — never touch payment.status
    payment.isDeleted = true;
    payment.deletedAt = now;
    payment.permanentDeleteAt = permanentDeleteAt;
    payment.deletedByAdminId = req.user._id;
    await payment.save();

    // Resolve worker for audit
    const workerProfile = await WorkerProfile.findOne({ userId: payment.workerId });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PAYMENT_DELETED',
      entityName: 'Payment',
      entityId: payment._id,
      previousValue: { status: payment.status, isDeleted: false },
      newValue: { isDeleted: true, deletedAt: now, permanentDeleteAt },
      notes: `Admin moved payment record to trash. Worker: ${workerProfile?.fullName || payment.workerId}. Event: ${payment.jobId?.title || payment.jobId}. Amount: ₹${payment.amount}. Payment status unchanged: ${payment.status}`,
      subjectName: workerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    res.json({ success: true, message: 'Payment moved to trash.', payment });
  } catch (error) {
    next(error);
  }
};

// Get trashed payment records
exports.getTrashPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ isDeleted: true })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone')
      .populate('deletedByAdminId', 'email')
      .sort({ deletedAt: -1 });

    const workerUserIds = payments.map((p) => p.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = payments.map((p) => {
      const pObj = p.toObject();
      if (p.workerId && workerMap.has(p.workerId._id.toString())) {
        pObj.workerProfile = workerMap.get(p.workerId._id.toString());
      }
      return pObj;
    });

    res.json({ success: true, payments: enriched });
  } catch (error) {
    next(error);
  }
};

// Restore a payment from Trash back to active
exports.restorePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id).populate('jobId', 'title');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    if (!payment.isDeleted) return res.status(400).json({ success: false, message: 'Payment is not in trash.' });

    payment.isDeleted = false;
    payment.deletedAt = null;
    payment.permanentDeleteAt = null;
    payment.deletedByAdminId = null;
    await payment.save();

    const workerProfile = await WorkerProfile.findOne({ userId: payment.workerId });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PAYMENT_RESTORED',
      entityName: 'Payment',
      entityId: payment._id,
      previousValue: { isDeleted: true },
      newValue: { isDeleted: false },
      notes: `Admin restored payment record from trash. Worker: ${workerProfile?.fullName || payment.workerId}. Event: ${payment.jobId?.title || payment.jobId}. Amount: ₹${payment.amount}. Status: ${payment.status}`,
      subjectName: workerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    res.json({ success: true, message: 'Payment restored successfully.', payment });
  } catch (error) {
    next(error);
  }
};

// Permanently delete a payment record from Trash.
// CRITICAL: This removes the Admin management record ONLY.
// The worker's historical payment outcome (PAID/COMPLETED) is NOT reversed.
exports.permanentDeletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id).populate('jobId', 'title');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });
    if (!payment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Payment must be in trash before permanent deletion.' });
    }

    const workerProfile = await WorkerProfile.findOne({ userId: payment.workerId });

    // Log BEFORE deleting so we capture all details
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PAYMENT_PERMANENTLY_DELETED',
      entityName: 'Payment',
      entityId: payment._id,
      previousValue: { status: payment.status, amount: payment.amount, isDeleted: true },
      newValue: null,
      notes: `Admin permanently deleted payment record. Worker: ${workerProfile?.fullName || payment.workerId}. Event: ${payment.jobId?.title || payment.jobId}. Amount: ₹${payment.amount}. Final business status was: ${payment.status}`,
      subjectName: workerProfile?.fullName || '',
      subjectRole: 'WORKER',
    });

    // CRITICAL BUSINESS RULE:
    // If this payment was PAID/COMPLETED, ensure the underlying Assignment preserves
    // the authoritative completed payment outcome so the worker/user still sees PAID / COMPLETED.
    if (payment.status === PAYMENT_STATUS.PAID && payment.assignmentId) {
      await Assignment.findByIdAndUpdate(payment.assignmentId, {
        paymentSettlement: {
          status: PAYMENT_STATUS.PAID,
          amount: payment.amount,
          paidAt: payment.paidAt || payment.updatedAt || new Date(),
          transactionRef: payment.transactionRef || '',
        },
      });
    }

    await Payment.deleteOne({ _id: id });

    res.json({ success: true, message: 'Payment record permanently deleted.' });
  } catch (error) {
    next(error);
  }
};

// Update Payment Status (PENDING -> PROCESSING -> PAID)
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId, status, transactionRef, adminNotes } = req.body;

    const payment = await Payment.findById(paymentId).populate('jobId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }
    // Cannot update a trashed payment
    if (payment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot update a trashed payment. Restore it first.' });
    }

    const previousStatus = payment.status;
    payment.status = status;
    if (transactionRef) payment.transactionRef = transactionRef;
    if (adminNotes !== undefined) payment.adminNotes = adminNotes;
    
    // Admin locks the payment
    payment.verifiedByAdminId = req.user._id;

    if (status === PAYMENT_STATUS.PROCESSING) {
      payment.processedAt = new Date();
    } else if (status === PAYMENT_STATUS.PAID) {
      payment.paidAt = new Date();
      // Ensure the underlying Assignment holds the authoritative settlement outcome
      if (payment.assignmentId) {
        await Assignment.findByIdAndUpdate(payment.assignmentId, {
          paymentSettlement: {
            status: PAYMENT_STATUS.PAID,
            amount: payment.amount,
            paidAt: payment.paidAt,
            transactionRef: transactionRef || payment.transactionRef || '',
          },
        });
      }
    }

    await payment.save();

    // Resolve worker name for audit trail
    const workerProfile = await WorkerProfile.findOne({ userId: payment.workerId });
    const workerName = workerProfile?.fullName || '';

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'UPDATE_PAYMENT_STATUS',
      entityName: 'Payment',
      entityId: payment._id,
      previousValue: previousStatus,
      newValue: status,
      notes: `Admin changed payment status to ${status}. Ref: ${transactionRef || 'N/A'}`,
      subjectName: workerName,
      subjectRole: 'WORKER',
    });

    await createNotification({
      userId: payment.workerId,
      title: `Payment ${status}!`,
      message: status === PAYMENT_STATUS.PAID
        ? `Your payout of ₹${payment.amount} for '${payment.jobId.title}' has been successfully completed! Ref: ${transactionRef || 'N/A'}`
        : `Payment status updated to ${status} for event '${payment.jobId.title}'.`,
      type: `PAYMENT_${status}`,
      link: '/worker/payments',
    });

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// Cancellation Requests Queue
exports.getCancellationRequests = async (req, res, next) => {
  try {
    const requests = await CancellationRequest.find()
      .populate('requestedByUserId', 'email phone role')
      .populate('jobId', 'title eventType eventDate')
      .populate('assignmentId')
      .sort({ createdAt: -1 });

    res.json({ success: true, cancellationRequests: requests });
  } catch (error) {
    next(error);
  }
};

// Handle Cancellation Request (Approve / Reject)
exports.handleCancellationRequest = async (req, res, next) => {
  try {
    const { requestId, action, adminNotes } = req.body; // action: 'APPROVE' or 'REJECT'

    const cancelReq = await CancellationRequest.findById(requestId);
    if (!cancelReq) {
      return res.status(404).json({ success: false, message: 'Cancellation request not found' });
    }

    cancelReq.status = action === 'APPROVE' ? CANCELLATION_STATUS.APPROVED : CANCELLATION_STATUS.REJECTED;
    cancelReq.adminNotes = adminNotes || '';
    cancelReq.handledByAdminId = req.user._id;
    cancelReq.handledAt = new Date();
    await cancelReq.save();

    if (action === 'APPROVE') {
      if (cancelReq.assignmentId) {
        await Assignment.findByIdAndUpdate(cancelReq.assignmentId, { status: ASSIGNMENT_STATUS.CANCELLED });
      } else if (cancelReq.jobId) {
        await Job.findByIdAndUpdate(cancelReq.jobId, { status: JOB_STATUS.CANCELLED });
      }
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: action === 'APPROVE' ? 'APPROVE_CANCELLATION' : 'REJECT_CANCELLATION',
      entityName: 'CancellationRequest',
      entityId: cancelReq._id,
      notes: `Admin ${action.toLowerCase()}d cancellation request.`,
    });

    await createNotification({
      userId: cancelReq.requestedByUserId,
      title: 'Cancellation Request Updated',
      message: `Your cancellation request has been ${action.toLowerCase()}d by Admin.`,
      type: 'CANCELLATION_UPDATED',
      link: cancelReq.requestedByRole === ROLES.RECRUITER ? '/recruiter/jobs' : '/worker/assignments',
    });

    res.json({ success: true, message: `Cancellation request ${action.toLowerCase()}d.`, cancellationRequest: cancelReq });
  } catch (error) {
    next(error);
  }
};

// Manage Users (Recruiters & Workers)
exports.getAllRecruiters = async (req, res, next) => {
  try {
    const { includeDeleted } = req.query;
    const userQuery = { role: ROLES.RECRUITER };
    if (includeDeleted !== 'true') {
      userQuery.isDeleted = { $ne: true };
      userQuery.status = { $ne: 'DELETED' };
    }
    const recruiterUsers = await User.find(userQuery).select('_id email phone status createdAt mustChangePassword isDeleted');
    const recruiterUserIds = recruiterUsers.map((u) => u._id);

    const recruiters = await RecruiterProfile.find({ userId: { $in: recruiterUserIds } })
      .populate('userId', 'email phone status createdAt mustChangePassword isDeleted');
    res.json({ success: true, recruiters });
  } catch (error) {
    next(error);
  }
};

exports.getAllWorkers = async (req, res, next) => {
  try {
    const { includeDeleted } = req.query;
    const userQuery = { role: ROLES.WORKER };
    if (includeDeleted !== 'true') {
      userQuery.isDeleted = { $ne: true };
      userQuery.status = { $ne: 'DELETED' };
    }
    const workerUsers = await User.find(userQuery).select('_id email phone status createdAt mustChangePassword isDeleted');
    const workerUserIds = workerUsers.map((u) => u._id);

    const workers = await WorkerProfile.find({ userId: { $in: workerUserIds } })
      .populate('userId', 'email phone status createdAt mustChangePassword isDeleted');
    res.json({ success: true, workers });
  } catch (error) {
    next(error);
  }
};

// Admin Delete User Account (Soft-delete & release identifiers for reuse, Admin protected)
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // MANDATORY BACKEND SECURITY CHECK: ADMIN ACCOUNT CAN NEVER BE DELETED
    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin account cannot be deleted.' });
    }

    // Capture profile snapshot and duplicate image for audit preservation
    let deletedUserName = '';
    let profileData = {};
    let profileImage = null;

    if (user.role === ROLES.WORKER) {
      const wp = await WorkerProfile.findOne({ userId: user._id }).lean();
      deletedUserName = wp?.fullName || user.email;
      profileData = wp || {};
      if (wp?.profilePhoto) {
        profileImage = await duplicateSavedImage(wp.profilePhoto);
      }
    } else {
      const rp = await RecruiterProfile.findOne({ userId: user._id }).lean();
      deletedUserName = rp?.fullName || rp?.companyName || user.email;
      profileData = rp || {};
      if (rp?.companyLogo) {
        profileImage = await duplicateSavedImage(rp.companyLogo);
      }
    }

    const previousStatus = user.status;
    const deletionTimestamp = new Date();

    const auditSnapshot = {
      actorUserId: req.user._id,
      actorRole: ROLES.ADMIN,
      action: 'USER_DELETED',
      targetUserId: user._id,
      targetRole: user.role,
      targetEmail: user.email,
      targetPhone: user.phone || profileData.phone || '',
      targetFullName: deletedUserName,
      fullName: deletedUserName,
      email: user.email,
      phone: user.phone || profileData.phone || '',
      role: user.role,
      profileImage,
      accountStatus: previousStatus,
      isDeleted: true,
      deletionTimestamp,
      profileInformation: profileData,
    };

    user.status = 'DELETED';
    user.isDeleted = true;
    user.deletedAt = deletionTimestamp;
    user.googleId = undefined;
    user.googleLinked = false;
    await user.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'USER_DELETED',
      entityName: 'User',
      entityId: user._id,
      previousValue: auditSnapshot,
      newValue: { status: 'DELETED', isDeleted: true },
      notes: reason
        ? `[${user.role} DELETED] ${reason}`
        : `Admin deleted ${user.role} account (${user.email}). Account marked DELETED. Historical records preserved.`,
      subjectName: deletedUserName,
      subjectRole: user.role,
    });

    res.json({
      success: true,
      message: `${user.role} account deleted successfully.`,
      user: { id: user._id, email: user.email, status: user.status, isDeleted: user.isDeleted },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { userId, status, reason } = req.body;
    
    if (!['ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') {
      return res.status(400).json({ success: false, message: 'Cannot modify Admin account status' });
    }

    // Only allow managing RECRUITER and WORKER roles
    if (![ROLES.RECRUITER, ROLES.WORKER].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Cannot modify this account type' });
    }

    // Deleted accounts cannot be reactivated via updateUserStatus
    if (user.isDeleted || user.status === 'DELETED') {
      return res.status(400).json({
        success: false,
        message: 'Deleted accounts cannot be reactivated directly. The user should register a fresh account.'
      });
    }

    const previousStatus = user.status;
    user.status = status;
    if (status === 'ACTIVE') {
      user.isDeleted = false;
      user.deletedAt = undefined;
    }
    await user.save();

    // Determine correct audit action name
    const auditAction = status === 'ACTIVE' ? 'USER_REACTIVATED'
      : status === 'SUSPENDED' ? 'USER_SUSPENDED'
      : status === 'BLOCKED' ? 'USER_BLOCKED'
      : 'USER_DEACTIVATED';

    // Resolve subject name
    let statusUserName = '';
    if (user.role === ROLES.WORKER) {
      const wp = await WorkerProfile.findOne({ userId: user._id });
      statusUserName = wp?.fullName || user.email;
    } else {
      const rp = await RecruiterProfile.findOne({ userId: user._id });
      statusUserName = rp?.fullName || user.email;
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: auditAction,
      entityName: 'User',
      entityId: user._id,
      previousValue: { status: previousStatus },
      newValue: { status },
      notes: reason
        ? `[${user.role}] ${reason}`
        : `Admin updated ${user.role} account status from ${previousStatus} to ${status}`,
      subjectName: statusUserName,
      subjectRole: user.role,
    });

    // Notify the affected user
    const statusMessages = {
      ACTIVE: 'Your account has been reactivated. You can now log in normally.',
      SUSPENDED: 'Your account has been suspended by Admin. You cannot access most features until reactivated.',
      BLOCKED: 'Your account has been blocked by Admin. Please contact support.',
      DEACTIVATED: 'Your account has been deactivated by Admin.',
    };
    await createNotification({
      userId: user._id,
      title: `Account Status Updated: ${status}`,
      message: statusMessages[status] || `Your account status has been changed to ${status}.`,
      type: 'ACCOUNT_STATUS_CHANGED',
      link: '/login',
    });

    res.json({
      success: true,
      message: `User account is now ${status}.`,
      status: user.status,
    });
  } catch (error) {
    next(error);
  }
};

exports.resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') return res.status(400).json({ success: false, message: 'Admin account cannot be reset.' });

    // Only allow managing RECRUITER and WORKER roles
    if (![ROLES.RECRUITER, ROLES.WORKER].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Cannot reset password for this account type' });
    }

    // Generate temporary password — stored ONLY as bcrypt hash, never as plaintext
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12-char hex string
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(tempPassword, salt);
    user.mustChangePassword = true;
    await user.save();

    // Audit: PASSWORD_RESET_REQUESTED (admin initiates). Never log the password or hash.
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PASSWORD_RESET_REQUESTED',
      entityName: 'User',
      entityId: user._id,
      notes: reason
        ? `[${user.role}] ${reason}`
        : `Admin reset ${user.role} password. User must change on next login.`,
    });

    // Notify the affected user
    await createNotification({
      userId: user._id,
      title: 'Password Reset by Admin',
      message: 'Your password has been reset by Admin. You will be required to set a new password on your next login.',
      type: 'PASSWORD_RESET',
      link: '/login',
    });

    res.json({
      success: true,
      message: 'Password reset successfully. User must change it on next login.',
      temporaryPassword: tempPassword, // shown once in Admin UI; never stored as plaintext
    });
  } catch (error) {
    next(error);
  }
};

exports.forceUserPasswordChange = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') return res.status(403).json({ success: false, message: 'Admin account cannot be modified.' });

    // Only allow managing RECRUITER and WORKER roles
    if (![ROLES.RECRUITER, ROLES.WORKER].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Cannot modify this account type' });
    }

    user.mustChangePassword = true;
    await user.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'FORCE_PASSWORD_CHANGE_ENABLED',
      entityName: 'User',
      entityId: user._id,
      notes: reason
        ? `[${user.role}] ${reason}`
        : `Admin forced ${user.role} to change password on next login`,
    });

    // Notify the affected user
    await createNotification({
      userId: user._id,
      title: 'Password Change Required',
      message: 'An Admin has required you to change your password. You will be prompted on your next login.',
      type: 'FORCE_PASSWORD_CHANGE',
      link: '/login',
    });

    res.json({
      success: true,
      message: 'Force password change enabled. User will be prompted on next login.',
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let user = await User.findById(id).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      // Allow resolving user via WorkerProfile or RecruiterProfile ID
      const wp = await WorkerProfile.findById(id);
      if (wp && wp.userId) {
        user = await User.findById(wp.userId).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
      } else {
        const rp = await RecruiterProfile.findById(id);
        if (rp && rp.userId) {
          user = await User.findById(rp.userId).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
        }
      }
    }
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Only allow viewing RECRUITER and WORKER accounts via this endpoint
    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot view Admin accounts via user management' });
    }

    let profile = null;
    let activityData = {};

    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId: user._id });
      const jobs = await Job.find({ recruiterId: user._id }).sort({ createdAt: -1 });
      const jobIds = jobs.map(j => j._id);
      const applications = await Application.find({ jobId: { $in: jobIds } })
        .populate('jobId', 'title eventType status eventDate location')
        .populate('workerId', 'email phone')
        .sort({ createdAt: -1 });

      activityData = {
        jobs,
        jobCount: jobs.length,
        pendingJobsCount: jobs.filter(j => j.status === JOB_STATUS.PENDING_REVIEW).length,
        approvedJobsCount: jobs.filter(j => j.status === JOB_STATUS.APPROVED).length,
        rejectedJobsCount: jobs.filter(j => j.status === JOB_STATUS.REJECTED).length,
        completedJobsCount: jobs.filter(j => j.status === JOB_STATUS.COMPLETED).length,
        applications,
        applicationCount: applications.length,
      };
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId: user._id });
      const applications = await Application.find({ workerId: user._id })
        .populate({
          path: 'jobId',
          select: 'title eventType status eventDate startTime endTime location adminApprovedPayment recruiterProposedPayment recruiterId requiredSkills responsibilities workerRequirements additionalInstructions cancellationReason statusHistory',
          populate: { path: 'recruiterId', select: 'email phone' },
        })
        .populate('reviewedByAdminId', 'email role')
        .sort({ createdAt: -1 });

      const assignments = await Assignment.find({ workerId: user._id })
        .populate({
          path: 'jobId',
          select: 'title eventType status eventDate startTime endTime location adminApprovedPayment recruiterProposedPayment recruiterId requiredSkills responsibilities workerRequirements additionalInstructions cancellationReason statusHistory',
          populate: { path: 'recruiterId', select: 'email phone' },
        })
        .populate('assignedByAdminId', 'email role')
        .populate('verifiedByAdminId', 'email role')
        .sort({ createdAt: -1 });

      const attendance = await Attendance.find({ workerId: user._id })
        .populate({
          path: 'jobId',
          select: 'title eventType status eventDate startTime endTime location adminApprovedPayment recruiterId',
          populate: { path: 'recruiterId', select: 'email phone' },
        })
        .populate('assignmentId', 'status paymentSettlement notes')
        .populate('verifiedByAdminId', 'email role')
        .sort({ date: -1, createdAt: -1 });

      const payments = await Payment.find({ workerId: user._id })
        .populate({
          path: 'jobId',
          select: 'title eventType status eventDate location adminApprovedPayment recruiterId',
          populate: { path: 'recruiterId', select: 'email phone' },
        })
        .populate('assignmentId', 'status paymentSettlement notes')
        .populate('verifiedByAdminId', 'email role')
        .sort({ createdAt: -1 });

      // Fetch recruiter company profiles for all jobs referenced in the worker's records
      const rawRecruiterIds = [
        ...applications.map((a) => a.jobId?.recruiterId?._id || a.jobId?.recruiterId),
        ...assignments.map((a) => a.jobId?.recruiterId?._id || a.jobId?.recruiterId),
        ...attendance.map((a) => a.jobId?.recruiterId?._id || a.jobId?.recruiterId),
        ...payments.map((p) => p.jobId?.recruiterId?._id || p.jobId?.recruiterId),
      ].filter(Boolean);

      const recruiterProfiles = await RecruiterProfile.find({ userId: { $in: rawRecruiterIds } });
      const recMap = new Map(recruiterProfiles.map((rp) => [rp.userId.toString(), rp.toObject()]));

      const attachRecruiterProfile = (doc) => {
        const obj = doc && doc.toObject ? doc.toObject() : (doc || {});
        const j = obj.jobId;
        if (j) {
          const recId = (j.recruiterId?._id || j.recruiterId)?.toString();
          if (recId && recMap.has(recId)) {
            j.recruiterProfile = recMap.get(recId);
          }
        }
        return obj;
      };

      const plainApplications = applications.map(attachRecruiterProfile);
      const plainAssignments = assignments.map(attachRecruiterProfile);
      const plainAttendance = attendance.map(attachRecruiterProfile);
      const plainPayments = payments.map(attachRecruiterProfile);

      activityData = {
        applications: plainApplications,
        applicationCount: plainApplications.length,
        assignments: plainAssignments,
        assignmentCount: plainAssignments.length,
        attendance: plainAttendance,
        attendanceCount: plainAttendance.length,
        payments: plainPayments,
        paymentCount: plainPayments.length,
        completedEventsCount: plainAssignments.filter((a) => a.status === ASSIGNMENT_STATUS.COMPLETED).length,
      };
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isDeleted: user.isDeleted || false,
        mustChangePassword: user.mustChangePassword,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.updatedAt,
        profile,
        ...activityData,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const logs = await AuditLog.find({ entityId: id })
      .populate('performedByUserId', 'email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, history: logs });
  } catch (error) {
    next(error);
  }
};

// Get All Assignments (Admin view)
exports.getAllAssignments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: { $ne: true } };
    if (status && status !== 'ALL') query.status = status;

    const totalDocs = await Assignment.countDocuments(query);
    const assignments = await Assignment.find(query)
      .populate('jobId', 'title eventType eventDate location adminApprovedPayment')
      .populate('workerId', 'email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const workerUserIds = assignments.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = assignments.map((a) => {
      const aObj = a.toObject();
      if (a.workerId && workerMap.has(a.workerId._id.toString())) {
        aObj.workerProfile = workerMap.get(a.workerId._id.toString());
      }
      return aObj;
    });

    res.json({
      success: true,
      assignments: enriched,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getTrashAssignments = async (req, res, next) => {
  try {
    const assignments = await Assignment.find({ isDeleted: true })
      .populate('jobId', 'title eventType eventDate location adminApprovedPayment')
      .populate('workerId', 'email phone')
      .sort({ deletedAt: -1 });

    const workerUserIds = assignments.map((a) => a.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const workerMap = new Map(workerProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = assignments.map((a) => {
      const aObj = a.toObject();
      if (a.workerId && workerMap.has(a.workerId._id.toString())) {
        aObj.workerProfile = workerMap.get(a.workerId._id.toString());
      }
      return aObj;
    });

    res.json({ success: true, assignments: enriched });
  } catch (error) {
    next(error);
  }
};

exports.softDeleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).populate('jobId', 'title').populate('workerId', 'email');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (assignment.isDeleted) return res.status(400).json({ success: false, message: 'Assignment is already in trash.' });

    assignment.isDeleted = true;
    assignment.deletedAt = new Date();
    
    const permDate = new Date();
    permDate.setDate(permDate.getDate() + 30);
    assignment.permanentDeleteAt = permDate;
    
    await assignment.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'ASSIGNMENT_DELETED',
      entityName: 'Assignment',
      entityId: assignment._id,
      notes: `Admin moved assignment to trash for worker ${assignment.workerId?.email || 'Unknown'} on job '${assignment.jobId?.title || 'Unknown'}'.`,
    });

    res.json({ success: true, message: 'Assignment moved to trash.' });
  } catch (error) {
    next(error);
  }
};

exports.restoreAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).populate('jobId', 'title').populate('workerId', 'email');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (!assignment.isDeleted) return res.status(400).json({ success: false, message: 'Assignment is not in trash.' });

    assignment.isDeleted = false;
    assignment.deletedAt = null;
    assignment.permanentDeleteAt = null;
    await assignment.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'RESTORE_ASSIGNMENT',
      entityName: 'Assignment',
      entityId: assignment._id,
      notes: `Admin restored assignment from trash for worker ${assignment.workerId?.email || 'Unknown'} on job '${assignment.jobId?.title || 'Unknown'}'.`,
    });

    res.json({ success: true, message: 'Assignment restored successfully.', assignment });
  } catch (error) {
    next(error);
  }
};

exports.permanentDeleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (!assignment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Assignment must be in trash before permanent deletion.' });
    }

    await Assignment.deleteOne({ _id: id });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'PERMANENT_DELETE_ASSIGNMENT',
      entityName: 'Assignment',
      entityId: assignment._id,
      notes: `Admin permanently deleted assignment.`,
    });

    res.json({ success: true, message: 'Assignment permanently deleted.' });
  } catch (error) {
    next(error);
  }
};


// ── Audit log entity enrichment helper ──────────────────────────────────────
// Batch-fetches related entity data for a list of audit logs.
// Returns the same logs with an added `entityData` field (no N+1 queries).
async function enrichAuditLogs(logs) {
  if (!logs || logs.length === 0) return logs;

  // ── Collect entity IDs per entityName bucket ────────────────────────────
  const buckets = {
    Payment: [], Job: [], User: [], Attendance: [],
    Assignment: [], Application: [], CancellationRequest: [],
  };

  for (const log of logs) {
    const id = log.entityId;
    if (!id) continue;
    if (buckets[log.entityName]) buckets[log.entityName].push(id);
  }

  // ── Fetch Payments ────────────────────────────────────────────────────────
  const paymentMap = new Map();
  if (buckets.Payment.length > 0) {
    const payments = await Payment.find({ _id: { $in: buckets.Payment } })
      .populate('jobId', 'title eventType eventDate location recruiterId recruiterProposedPayment adminApprovedPayment workersRequired')
      .populate('workerId', 'email phone');

    const workerUserIds = payments.map(p => p.workerId?._id).filter(Boolean);
    const workerProfiles = await WorkerProfile.find({ userId: { $in: workerUserIds } });
    const wMap = new Map(workerProfiles.map(p => [p.userId.toString(), p]));

    // Collect recruiter IDs from jobs
    const recruiterIds = payments.map(p => p.jobId?.recruiterId).filter(Boolean);
    const recruiterProfiles = recruiterIds.length > 0
      ? await RecruiterProfile.find({ userId: { $in: recruiterIds } })
      : [];
    const rMap = new Map(recruiterProfiles.map(p => [p.userId.toString(), p]));

    for (const p of payments) {
      const pObj = p.toObject();
      if (p.workerId?._id) pObj.workerProfile = wMap.get(p.workerId._id.toString()) || null;
      if (p.jobId?.recruiterId) pObj.recruiterProfile = rMap.get(p.jobId.recruiterId.toString()) || null;
      paymentMap.set(p._id.toString(), pObj);
    }
  }

  // ── Fetch Jobs ────────────────────────────────────────────────────────────
  const jobMap = new Map();
  if (buckets.Job.length > 0) {
    const jobs = await Job.find({ _id: { $in: buckets.Job } })
      .populate('recruiterId', 'email phone');

    const recruiterUserIds = jobs.map(j => j.recruiterId?._id).filter(Boolean);
    const recruiterProfiles = recruiterUserIds.length > 0
      ? await RecruiterProfile.find({ userId: { $in: recruiterUserIds } })
      : [];
    const rMap = new Map(recruiterProfiles.map(p => [p.userId.toString(), p]));

    for (const j of jobs) {
      const jObj = j.toObject();
      if (j.recruiterId?._id) jObj.recruiterProfile = rMap.get(j.recruiterId._id.toString()) || null;
      jobMap.set(j._id.toString(), jObj);
    }
  }

  // ── Fetch Users ───────────────────────────────────────────────────────────
  const userMap = new Map();
  if (buckets.User.length > 0) {
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: buckets.User } }).select('email phone role status');
    const workerProfiles2 = await WorkerProfile.find({ userId: { $in: buckets.User } });
    const recruiterProfiles2 = await RecruiterProfile.find({ userId: { $in: buckets.User } });
    const wMap2 = new Map(workerProfiles2.map(p => [p.userId.toString(), p]));
    const rMap2 = new Map(recruiterProfiles2.map(p => [p.userId.toString(), p]));

    for (const u of users) {
      const uObj = u.toObject();
      uObj.workerProfile = wMap2.get(u._id.toString()) || null;
      uObj.recruiterProfile = rMap2.get(u._id.toString()) || null;
      userMap.set(u._id.toString(), uObj);
    }
  }

  // ── Fetch Attendance ──────────────────────────────────────────────────────
  const attendanceMap = new Map();
  if (buckets.Attendance.length > 0) {
    const Attendance = require('../models/Attendance');
    const records = await Attendance.find({ _id: { $in: buckets.Attendance } })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone');

    const aWorkerIds = records.map(r => r.workerId?._id).filter(Boolean);
    const aWorkerProfiles = aWorkerIds.length > 0
      ? await WorkerProfile.find({ userId: { $in: aWorkerIds } })
      : [];
    const aWMap = new Map(aWorkerProfiles.map(p => [p.userId.toString(), p]));

    for (const r of records) {
      const rObj = r.toObject();
      if (r.workerId?._id) rObj.workerProfile = aWMap.get(r.workerId._id.toString()) || null;
      attendanceMap.set(r._id.toString(), rObj);
    }
  }

  // ── Fetch Assignments ─────────────────────────────────────────────────────
  const assignmentMap = new Map();
  if (buckets.Assignment.length > 0) {
    const Assignment = require('../models/Assignment');
    const assignments = await Assignment.find({ _id: { $in: buckets.Assignment } })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone');

    const asWorkerIds = assignments.map(a => a.workerId?._id).filter(Boolean);
    const asWorkerProfiles = asWorkerIds.length > 0
      ? await WorkerProfile.find({ userId: { $in: asWorkerIds } })
      : [];
    const asWMap = new Map(asWorkerProfiles.map(p => [p.userId.toString(), p]));

    for (const a of assignments) {
      const aObj = a.toObject();
      if (a.workerId?._id) aObj.workerProfile = asWMap.get(a.workerId._id.toString()) || null;
      assignmentMap.set(a._id.toString(), aObj);
    }
  }

  // ── Fetch Applications ────────────────────────────────────────────────────
  const applicationMap = new Map();
  if (buckets.Application.length > 0) {
    const Application = require('../models/Application');
    const applications = await Application.find({ _id: { $in: buckets.Application } })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone');

    const appWorkerIds = applications.map(a => a.workerId?._id).filter(Boolean);
    const appWorkerProfiles = appWorkerIds.length > 0
      ? await WorkerProfile.find({ userId: { $in: appWorkerIds } })
      : [];
    const appWMap = new Map(appWorkerProfiles.map(p => [p.userId.toString(), p]));

    for (const a of applications) {
      const aObj = a.toObject();
      if (a.workerId?._id) aObj.workerProfile = appWMap.get(a.workerId._id.toString()) || null;
      applicationMap.set(a._id.toString(), aObj);
    }
  }

  // ── Fetch CancellationRequests ────────────────────────────────────────────
  const cancelMap = new Map();
  if (buckets.CancellationRequest.length > 0) {
    const CancellationRequest = require('../models/CancellationRequest');
    const cancels = await CancellationRequest.find({ _id: { $in: buckets.CancellationRequest } })
      .populate('jobId', 'title eventType eventDate location')
      .populate('requestedByUserId', 'email phone role');

    const cancelUserIds = cancels.map(c => c.requestedByUserId?._id).filter(Boolean);
    const cancelWorkerProfiles = await WorkerProfile.find({ userId: { $in: cancelUserIds } });
    const cancelRecruiterProfiles = await RecruiterProfile.find({ userId: { $in: cancelUserIds } });
    const cwMap = new Map(cancelWorkerProfiles.map(p => [p.userId.toString(), p]));
    const crMap = new Map(cancelRecruiterProfiles.map(p => [p.userId.toString(), p]));

    for (const c of cancels) {
      const cObj = c.toObject();
      const uid = c.requestedByUserId?._id?.toString();
      if (uid) {
        cObj.workerProfile = cwMap.get(uid) || null;
        cObj.recruiterProfile = crMap.get(uid) || null;
      }
      cancelMap.set(c._id.toString(), cObj);
    }
  }

  // ── Entity-type to map lookup ─────────────────────────────────────────────
  const entityMaps = {
    Payment: paymentMap,
    Job: jobMap,
    User: userMap,
    Attendance: attendanceMap,
    Assignment: assignmentMap,
    Application: applicationMap,
    CancellationRequest: cancelMap,
  };

  // ── Helper: derive subject name + role from enriched entityData ─────────
  function deriveSubject(entityName, ed) {
    if (!ed) return { subjectName: '', subjectRole: '' };
    switch (entityName) {
      case 'Payment': {
        const name = ed.workerProfile?.fullName || ed.workerId?.email || '';
        return { subjectName: name, subjectRole: name ? 'WORKER' : '' };
      }
      case 'Job': {
        const name = ed.recruiterProfile?.fullName || ed.recruiterId?.email || '';
        return { subjectName: name, subjectRole: name ? 'RECRUITER' : '' };
      }
      case 'User': {
        const wp = ed.workerProfile;
        const rp = ed.recruiterProfile;
        if (wp?.fullName) return { subjectName: wp.fullName, subjectRole: 'WORKER' };
        if (rp?.fullName) return { subjectName: rp.fullName, subjectRole: 'RECRUITER' };
        if (ed.email) return { subjectName: ed.email, subjectRole: ed.role || '' };
        return { subjectName: '', subjectRole: '' };
      }
      case 'Attendance':
      case 'Assignment':
      case 'Application': {
        const name = ed.workerProfile?.fullName || ed.workerId?.email || '';
        return { subjectName: name, subjectRole: name ? 'WORKER' : '' };
      }
      case 'CancellationRequest': {
        const wp = ed.workerProfile;
        const rp = ed.recruiterProfile;
        if (wp?.fullName) return { subjectName: wp.fullName, subjectRole: 'WORKER' };
        if (rp?.fullName) return { subjectName: rp.fullName, subjectRole: 'RECRUITER' };
        if (ed.requestedByUserId?.email) return { subjectName: ed.requestedByUserId.email, subjectRole: ed.requestedByRole || '' };
        return { subjectName: '', subjectRole: '' };
      }
      default:
        return { subjectName: '', subjectRole: '' };
    }
  }

  // ── Fetch Performer Profiles (for WORKER / RECRUITER performers) ────────
  const perfWorkerIds = logs
    .filter(l => l.performedByRole === 'WORKER' && (l.performedByUserId?._id || l.performedByUserId))
    .map(l => (l.performedByUserId._id || l.performedByUserId).toString());
  const perfRecruiterIds = logs
    .filter(l => l.performedByRole === 'RECRUITER' && (l.performedByUserId?._id || l.performedByUserId))
    .map(l => (l.performedByUserId._id || l.performedByUserId).toString());

  const pWorkers = perfWorkerIds.length > 0
    ? await WorkerProfile.find({ userId: { $in: perfWorkerIds } }).select('userId profilePhoto fullName email')
    : [];
  const pRecruiters = perfRecruiterIds.length > 0
    ? await RecruiterProfile.find({ userId: { $in: perfRecruiterIds } }).select('userId companyLogo fullName email')
    : [];

  const pwMap = new Map(pWorkers.map(w => [w.userId.toString(), w]));
  const prMap = new Map(pRecruiters.map(r => [r.userId.toString(), r]));

  // ── Attach entityData + resolved subject + profileImage to each log ───────
  return logs.map(log => {
    const logObj = typeof log.toObject === 'function' ? log.toObject() : { ...log };
    const id = log.entityId?.toString();
    const map = entityMaps[log.entityName];
    logObj.entityData = (id && map) ? (map.get(id) || null) : null;

    // If subjectName was already stored on the audit record, keep it.
    // Otherwise derive it from the enriched entityData or previousValue snapshot.
    if (!logObj.subjectName) {
      if (logObj.action === 'ACCOUNT_SELF_DELETED' && logObj.previousValue) {
        logObj.subjectName = logObj.previousValue.fullName || logObj.previousValue.targetFullName || logObj.previousValue.email || '';
        logObj.subjectRole = logObj.previousValue.role || logObj.previousValue.targetRole || logObj.previousValue.actorRole || '';
      } else {
        const derived = deriveSubject(log.entityName, logObj.entityData);
        logObj.subjectName = derived.subjectName;
        logObj.subjectRole = derived.subjectRole;
      }
    }

    // ── Resolve Profile Photo (Worker profilePhoto or Recruiter companyLogo) ──
    // RULE: Strictly role-separated. Worker-typed entities NEVER use recruiterProfile
    // and vice versa. Empty string companyLogo (the DB default) is treated as null.
    let profileImage = null;

    // Helper: a photo URL is only valid when it is a non-empty, non-whitespace string.
    const isValidPhoto = (p) => typeof p === 'string' && p.trim().length > 0;

    // 1. From enriched entityData — role-strict
    if (logObj.entityData) {
      // Worker-only entity types
      const isWorkerEntity = ['Payment', 'Attendance', 'Assignment', 'Application'].includes(log.entityName);
      // Recruiter-only entity types
      const isRecruiterEntity = log.entityName === 'Job';
      // Mixed entity types: resolve by stored subjectRole
      const subjectRole = (logObj.subjectRole || '').toUpperCase();

      if (isWorkerEntity) {
        const p = logObj.entityData.workerProfile?.profilePhoto;
        if (isValidPhoto(p)) profileImage = p;
      } else if (isRecruiterEntity) {
        const p = logObj.entityData.recruiterProfile?.companyLogo;
        if (isValidPhoto(p)) profileImage = p;
      } else {
        // User / CancellationRequest — use subjectRole to pick the right profile
        if (subjectRole === 'WORKER') {
          const p = logObj.entityData.workerProfile?.profilePhoto;
          if (isValidPhoto(p)) profileImage = p;
        } else if (subjectRole === 'RECRUITER') {
          const p = logObj.entityData.recruiterProfile?.companyLogo;
          if (isValidPhoto(p)) profileImage = p;
        } else {
          // Unknown role — check worker first, then recruiter
          const wp = logObj.entityData.workerProfile?.profilePhoto;
          const rp = logObj.entityData.recruiterProfile?.companyLogo;
          if (isValidPhoto(wp)) profileImage = wp;
          else if (isValidPhoto(rp)) profileImage = rp;
        }
      }
    }

    // 2. From performer profile if performed by WORKER or RECRUITER
    if (!profileImage && log.performedByUserId) {
      const pId = (log.performedByUserId._id || log.performedByUserId).toString();
      if (log.performedByRole === 'WORKER') {
        const wp = pwMap.get(pId);
        if (isValidPhoto(wp?.profilePhoto)) profileImage = wp.profilePhoto;
      } else if (log.performedByRole === 'RECRUITER') {
        const rp = prMap.get(pId);
        if (isValidPhoto(rp?.companyLogo)) profileImage = rp.companyLogo;
      }
    }

    // 3. From historical snapshot (ACCOUNT_SELF_DELETED / USER_DELETED)
    if (!profileImage && logObj.previousValue) {
      const subjectRole = (logObj.subjectRole || '').toUpperCase();
      const snapshotPhoto = logObj.previousValue.profileInformation?.profilePhoto ||
                            logObj.previousValue.profileImage || null;
      const snapshotLogo  = logObj.previousValue.profileInformation?.companyLogo ||
                            logObj.previousValue.companyLogo || null;
      if (subjectRole === 'WORKER' && isValidPhoto(snapshotPhoto)) {
        profileImage = snapshotPhoto;
      } else if (subjectRole === 'RECRUITER' && isValidPhoto(snapshotLogo)) {
        profileImage = snapshotLogo;
      } else {
        // Ambiguous — try photo then logo
        if (isValidPhoto(snapshotPhoto)) profileImage = snapshotPhoto;
        else if (isValidPhoto(snapshotLogo)) profileImage = snapshotLogo;
      }
    }

    logObj.profileImage = profileImage || null;

    return logObj;
  });
}


// System Audit Logs — active (not deleted)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ isDeleted: { $ne: true } })
      .populate('performedByUserId', 'email role')
      .sort({ createdAt: -1 })
      .limit(200);
    const enriched = await enrichAuditLogs(logs);
    res.json({ success: true, auditLogs: enriched });
  } catch (error) {
    next(error);
  }
};


// Soft-delete an audit log → Trash
exports.softDeleteAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findById(id);
    if (!log) return res.status(404).json({ success: false, message: 'Audit log not found.' });
    if (log.isDeleted) return res.status(400).json({ success: false, message: 'Already in trash.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    log.isDeleted = true;
    log.deletedAt = now;
    log.permanentDeleteAt = permanentDeleteAt;
    await log.save();

    res.json({ success: true, message: 'Audit log moved to trash.', log });
  } catch (error) {
    next(error);
  }
};

// Get Trash — all soft-deleted audit logs
exports.getTrashAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ isDeleted: true })
      .populate('performedByUserId', 'email role')
      .sort({ deletedAt: -1 });
    const enriched = await enrichAuditLogs(logs);
    res.json({ success: true, auditLogs: enriched });
  } catch (error) {
    next(error);
  }
};


// Restore an audit log from Trash
exports.restoreAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findById(id);
    if (!log) return res.status(404).json({ success: false, message: 'Audit log not found.' });
    if (!log.isDeleted) return res.status(400).json({ success: false, message: 'Audit log is not in trash.' });

    log.isDeleted = false;
    log.deletedAt = null;
    log.permanentDeleteAt = null;
    await log.save();

    res.json({ success: true, message: 'Audit log restored successfully.', log });
  } catch (error) {
    next(error);
  }
};

// Permanently delete one audit log (Admin explicit action from Trash)
exports.permanentDeleteAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findById(id);
    if (!log) return res.status(404).json({ success: false, message: 'Audit log not found.' });
    if (!log.isDeleted) {
      return res.status(400).json({ success: false, message: 'Audit log must be in trash before permanent deletion.' });
    }

    // Clean up audit-specific historical profile image for self-deleted accounts
    if (log.action === 'ACCOUNT_SELF_DELETED' && log.previousValue?.profileImage) {
      const auditImage = log.previousValue.profileImage;
      // Only delete images that were created specifically for the audit snapshot (prefixed audit-)
      if (typeof auditImage === 'string' && auditImage.includes('/audit-')) {
        await deleteSavedImage(auditImage);
      }
    }

    await AuditLog.deleteOne({ _id: id });
    res.json({ success: true, message: 'Audit log permanently deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE APPLICATION STATUS ────────────────────────────────────────────────
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = [
      APPLICATION_STATUS.APPROVED,
      APPLICATION_STATUS.SUSPENDED,
      APPLICATION_STATUS.REJECTED,
      APPLICATION_STATUS.COMPLETED
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status.' });
    }

    const application = await Application.findById(id).populate('jobId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    application.status = status;
    application.reviewedByAdminId = req.user._id;
    application.reviewedAt = new Date();
    if (adminNotes !== undefined) {
      application.adminNotes = adminNotes;
    }
    await application.save();

    if (status === APPLICATION_STATUS.APPROVED) {
      await syncSingleApprovedApplication(application, req.user._id, adminNotes);

      const workerProfile = await WorkerProfile.findOne({ userId: application.workerId });
      await logAuditEvent({
        performedByUserId: req.user._id,
        performedByRole: ROLES.ADMIN,
        action: 'APPROVE_APPLICATION',
        entityName: 'Application',
        entityId: application._id,
        notes: `Admin approved worker application via status update`,
        subjectName: workerProfile?.fullName || '',
        subjectRole: 'WORKER',
      });

      await createNotification({
        userId: application.workerId,
        title: 'Application Approved!',
        message: `Your application for '${application.jobId?.title || 'Job'}' has been approved by Admin.`,
        type: 'APPLICATION_APPROVED',
        link: '/worker/assignments',
      });
    } else if (status === APPLICATION_STATUS.REJECTED || status === APPLICATION_STATUS.SUSPENDED) {
      const rawJobId = application.jobId?._id || application.jobId;
      const assignment = await Assignment.findOne({ jobId: rawJobId, workerId: application.workerId });
      if (assignment) {
        if (status === APPLICATION_STATUS.REJECTED) {
          assignment.status = ASSIGNMENT_STATUS.REJECTED;
        } else if (status === APPLICATION_STATUS.SUSPENDED) {
          assignment.status = ASSIGNMENT_STATUS.SUSPENDED;
        }
        await assignment.save();

        await Attendance.updateMany(
          { assignmentId: assignment._id, status: ATTENDANCE_STATUS.PENDING },
          { $set: { isDeleted: true, deletedAt: new Date() } }
        );

        const job = await Job.findById(rawJobId);
        if (job) {
          const activeCount = await Assignment.countDocuments({
            jobId: job._id,
            isDeleted: { $ne: true },
            status: { $in: [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.CONFIRMED, ASSIGNMENT_STATUS.IN_PROGRESS, ASSIGNMENT_STATUS.COMPLETED] },
          });
          job.assignedWorkersCount = activeCount;
          await job.save();
        }
      }
    }

    res.json({ success: true, message: 'Application status updated.', application });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE ASSIGNMENT STATUS ────────────────────────────────────────────────
exports.updateAssignmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      ASSIGNMENT_STATUS.ASSIGNED,
      ASSIGNMENT_STATUS.SUSPENDED,
      ASSIGNMENT_STATUS.REJECTED,
      ASSIGNMENT_STATUS.COMPLETED
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid assignment status.' });
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    assignment.status = status;
    await assignment.save();

    res.json({ success: true, message: 'Assignment status updated.', assignment });
  } catch (error) {
    next(error);
  }
};

// Update user rating
exports.updateUserRating = async (req, res, next) => {
  try {
    let { rating } = req.body;
    const userId = req.params.id;

    // Treat explicit null, 'null', '', or undefined as "Remove rating"
    const isRemoving = rating === null || rating === 'null' || rating === '' || rating === undefined;

    let parsedRating = null;
    if (!isRemoving) {
      parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let profile;
    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId });
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId });
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const previousRating = profile.rating;

    // Use $unset to physically remove the rating if removing, else set it
    if (isRemoving) {
      profile.rating = undefined; // Mongoose will handle $unset if we save, but let's be explicit
      await profile.updateOne({ $unset: { rating: 1 } });
      // update profile in memory for response
      profile.rating = undefined;
    } else {
      profile.rating = parsedRating;
      await profile.save();
    }

    // Determine audit action
    let auditAction = 'ADMIN_GAVE_RATING';
    let notes = `Admin gave rating of ${parsedRating}/5`;
    if (isRemoving) {
      auditAction = 'ADMIN_REMOVED_RATING';
      notes = `Admin removed user rating (was ${previousRating}/5)`;
    } else if (previousRating !== undefined && previousRating !== null) {
      auditAction = 'ADMIN_CHANGED_RATING';
      notes = `Admin changed rating from ${previousRating}/5 to ${parsedRating}/5`;
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: auditAction,
      entityName: 'User',
      entityId: user._id,
      previousValue: { rating: previousRating },
      newValue: { rating: isRemoving ? null : parsedRating },
      notes: notes,
      subjectName: profile.fullName || profile.companyName || user.email,
      subjectRole: user.role,
    });

    res.json({ success: true, message: isRemoving ? 'Rating removed successfully' : 'Rating updated successfully', profile });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// BULK ACTION CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

// Helper: validate an array of MongoDB ObjectId strings
function validateIds(ids) {
  const mongoose = require('mongoose');
  if (!Array.isArray(ids) || ids.length === 0) return false;
  return ids.every((id) => mongoose.isValidObjectId(id));
}

// ── JOBS bulk ─────────────────────────────────────────────────────────────────

exports.bulkSoftDeleteJobs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const jobs = await Job.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (jobs.length === 0) return res.status(400).json({ success: false, message: 'No eligible jobs found for deletion.' });

    await Job.updateMany(
      { _id: { $in: jobs.map((j) => j._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'Job',
      entityId: req.user._id,
      notes: `Admin bulk moved ${jobs.length} job(s) to trash. IDs: ${jobs.map((j) => j._id).join(', ')}`,
    });

    res.json({ success: true, message: `${jobs.length} job(s) moved to trash.`, count: jobs.length });
  } catch (error) { next(error); }
};

exports.bulkRestoreJobs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const jobs = await Job.find({ _id: { $in: ids }, isDeleted: true });
    if (jobs.length === 0) return res.status(400).json({ success: false, message: 'No eligible jobs found in trash.' });

    await Job.updateMany(
      { _id: { $in: jobs.map((j) => j._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'Job',
      entityId: req.user._id,
      notes: `Admin bulk restored ${jobs.length} job(s) from trash. IDs: ${jobs.map((j) => j._id).join(', ')}`,
    });

    res.json({ success: true, message: `${jobs.length} job(s) restored.`, count: jobs.length });
  } catch (error) { next(error); }
};

exports.bulkPermanentDeleteJobs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const jobs = await Job.find({ _id: { $in: ids }, isDeleted: true });
    if (jobs.length === 0) return res.status(400).json({ success: false, message: 'No eligible jobs found in trash for permanent deletion.' });

    const jobIds = jobs.map((j) => j._id);
    await Job.deleteMany({ _id: { $in: jobIds } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'Job',
      entityId: req.user._id,
      notes: `Admin permanently deleted ${jobs.length} job(s). IDs: ${jobIds.join(', ')}`,
    });

    res.json({ success: true, message: `${jobs.length} job(s) permanently deleted.`, count: jobs.length });
  } catch (error) { next(error); }
};

// ── APPLICATIONS bulk ─────────────────────────────────────────────────────────

exports.bulkSoftDeleteApplications = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const apps = await Application.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (apps.length === 0) return res.status(400).json({ success: false, message: 'No eligible applications found.' });

    await Application.updateMany(
      { _id: { $in: apps.map((a) => a._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'Application',
      entityId: req.user._id,
      notes: `Admin bulk moved ${apps.length} application(s) to trash. IDs: ${apps.map((a) => a._id).join(', ')}`,
    });

    res.json({ success: true, message: `${apps.length} application(s) moved to trash.`, count: apps.length });
  } catch (error) { next(error); }
};

exports.bulkRestoreApplications = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const apps = await Application.find({ _id: { $in: ids }, isDeleted: true });
    if (apps.length === 0) return res.status(400).json({ success: false, message: 'No eligible applications found in trash.' });

    await Application.updateMany(
      { _id: { $in: apps.map((a) => a._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null } }
    );

    for (const app of apps) {
      if (app.status === APPLICATION_STATUS.APPROVED) {
        await syncSingleApprovedApplication(app, req.user._id, '', true);
      }
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'Application',
      entityId: req.user._id,
      notes: `Admin bulk restored ${apps.length} application(s). IDs: ${apps.map((a) => a._id).join(', ')}`,
    });

    res.json({ success: true, message: `${apps.length} application(s) restored.`, count: apps.length });
  } catch (error) { next(error); }
};

exports.bulkPermanentDeleteApplications = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const apps = await Application.find({ _id: { $in: ids }, isDeleted: true });
    if (apps.length === 0) return res.status(400).json({ success: false, message: 'No eligible applications found in trash.' });

    await Application.deleteMany({ _id: { $in: apps.map((a) => a._id) } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'Application',
      entityId: req.user._id,
      notes: `Admin permanently deleted ${apps.length} application(s). IDs: ${apps.map((a) => a._id).join(', ')}`,
    });

    res.json({ success: true, message: `${apps.length} application(s) permanently deleted.`, count: apps.length });
  } catch (error) { next(error); }
};

// ── ASSIGNMENTS bulk ──────────────────────────────────────────────────────────

exports.bulkSoftDeleteAssignments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const docs = await Assignment.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible assignments found.' });

    await Assignment.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'Assignment',
      entityId: req.user._id,
      notes: `Admin bulk moved ${docs.length} assignment(s) to trash. IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} assignment(s) moved to trash.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkRestoreAssignments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await Assignment.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible assignments found in trash.' });

    await Assignment.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'Assignment',
      entityId: req.user._id,
      notes: `Admin bulk restored ${docs.length} assignment(s). IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} assignment(s) restored.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkPermanentDeleteAssignments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await Assignment.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible assignments in trash.' });

    await Assignment.deleteMany({ _id: { $in: docs.map((d) => d._id) } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'Assignment',
      entityId: req.user._id,
      notes: `Admin permanently deleted ${docs.length} assignment(s). IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} assignment(s) permanently deleted.`, count: docs.length });
  } catch (error) { next(error); }
};

// ── ATTENDANCE bulk ───────────────────────────────────────────────────────────

exports.bulkSoftDeleteAttendance = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const docs = await Attendance.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible attendance records found.' });

    await Attendance.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_DELETE',
      entityName: 'Attendance',
      entityId: req.user._id,
      notes: `Admin bulk moved ${docs.length} attendance record(s) to trash. IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} attendance record(s) moved to trash.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkRestoreAttendance = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await Attendance.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible attendance records in trash.' });

    await Attendance.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null } }
    );

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_RESTORE',
      entityName: 'Attendance',
      entityId: req.user._id,
      notes: `Admin bulk restored ${docs.length} attendance record(s). IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} attendance record(s) restored.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkPermanentDeleteAttendance = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await Attendance.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible attendance records in trash.' });

    await Attendance.deleteMany({ _id: { $in: docs.map((d) => d._id) } });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.ADMIN,
      action: 'BULK_PERMANENT_DELETE',
      entityName: 'Attendance',
      entityId: req.user._id,
      notes: `Admin permanently deleted ${docs.length} attendance record(s). IDs: ${docs.map((d) => d._id).join(', ')}`,
    });

    res.json({ success: true, message: `${docs.length} attendance record(s) permanently deleted.`, count: docs.length });
  } catch (error) { next(error); }
};

// ── AUDIT LOG bulk ────────────────────────────────────────────────────────────

exports.bulkRestoreAuditLogs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await AuditLog.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible audit logs in trash.' });

    await AuditLog.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: false, deletedAt: null, permanentDeleteAt: null } }
    );

    res.json({ success: true, message: `${docs.length} audit log(s) restored.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkPermanentDeleteAuditLogs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const docs = await AuditLog.find({ _id: { $in: ids }, isDeleted: true });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible audit logs in trash.' });

    await AuditLog.deleteMany({ _id: { $in: docs.map((d) => d._id) } });

    res.json({ success: true, message: `${docs.length} audit log(s) permanently deleted.`, count: docs.length });
  } catch (error) { next(error); }
};

exports.bulkSoftDeleteAuditLogs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!validateIds(ids)) return res.status(400).json({ success: false, message: 'Invalid or empty ids array.' });

    const now = new Date();
    const permanentDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const docs = await AuditLog.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No eligible audit logs found for deletion.' });

    await AuditLog.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { isDeleted: true, deletedAt: now, permanentDeleteAt } }
    );

    res.json({ success: true, message: `${docs.length} audit log(s) moved to trash.`, count: docs.length });
  } catch (error) { next(error); }
};

