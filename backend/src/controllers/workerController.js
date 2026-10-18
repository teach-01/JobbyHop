const WorkerProfile = require('../models/WorkerProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Assignment = require('../models/Assignment');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const CancellationRequest = require('../models/CancellationRequest');
const { createNotification } = require('../services/notificationService');
const { logAuditEvent } = require('../services/auditService');
const { JOB_STATUS, APPLICATION_STATUS, ASSIGNMENT_STATUS, ATTENDANCE_STATUS, ROLES } = require('../config/constants');
const { validateWorkerProfilePhoto } = require('../utils/imageValidator');
const { saveBase64Image } = require('../utils/imageStorage');

// Get worker profile
exports.getProfile = async (req, res, next) => {
  try {
    const profile = await WorkerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Worker profile not found' });
    }
    res.json({ success: true, profile });
  } catch (error) {
    next(error);
  }
};

// Update worker profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { location, skills, experience, bio, preferredEventTypes } = req.body;

    let profile = await WorkerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Normalized aliases for immutable personal details
    const incomingFullName = req.body.fullName ?? req.body.fullLegalName ?? req.body.legalName;
    const incomingDob = req.body.dob ?? req.body.dateOfBirth;
    const incomingPhone = req.body.phone ?? req.body.phoneNumber;
    const incomingProfilePhoto = req.body.profilePhoto ?? req.body.photo;

    // STRICT IMMUTABILITY RULES:
    // If these fields already exist on the profile, any attempt to change, replace,
    // or remove them must be rejected by the backend.
    const attemptedModifications = [];

    // Full Legal Name immutability
    if (profile.fullName && incomingFullName !== undefined) {
      if (String(incomingFullName).trim() !== String(profile.fullName).trim()) {
        attemptedModifications.push('Full Legal Name');
      }
    }

    // Date of Birth immutability
    if (profile.dob && incomingDob !== undefined) {
      const existingDateStr = new Date(profile.dob).toISOString().split('T')[0];
      let incomingDateStr = '';
      try {
        incomingDateStr = incomingDob ? new Date(incomingDob).toISOString().split('T')[0] : '';
      } catch (e) {
        incomingDateStr = String(incomingDob);
      }
      if (incomingDateStr !== existingDateStr) {
        attemptedModifications.push('Date of Birth');
      }
    }

    // Phone Number immutability
    if (profile.phone && incomingPhone !== undefined) {
      if (String(incomingPhone).trim() !== String(profile.phone).trim()) {
        attemptedModifications.push('Phone Number');
      }
    }

    // Profile Photo immutability
    if (profile.profilePhoto && incomingProfilePhoto !== undefined) {
      const incomingTrimmed = String(incomingProfilePhoto).trim();
      const existingTrimmed = String(profile.profilePhoto).trim();
      if (incomingTrimmed !== existingTrimmed) {
        let isSameImage = false;
        if (existingTrimmed.startsWith('/uploads/') && incomingTrimmed.startsWith('data:')) {
          try {
            const fs = require('fs');
            const path = require('path');
            const uploadsDir = path.join(__dirname, '../../uploads');
            const filepath = path.join(uploadsDir, path.basename(existingTrimmed));
            if (fs.existsSync(filepath)) {
              const savedBuffer = fs.readFileSync(filepath);
              const base64Data = incomingTrimmed.replace(/^data:[^;]+;base64,/i, '');
              const incomingBuffer = Buffer.from(base64Data, 'base64');
              if (Buffer.compare(savedBuffer, incomingBuffer) === 0) {
                isSameImage = true;
              }
            }
          } catch (e) {
            // ignore
          }
        }
        if (!isSameImage) {
          attemptedModifications.push('Profile Photo');
        }
      }
    }

    if (attemptedModifications.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
      });
    }

    // If any immutable field was not previously set on this profile, allow setting it once:
    if (!profile.fullName && incomingFullName) {
      profile.fullName = String(incomingFullName).trim();
    }
    if (!profile.dob && incomingDob) {
      profile.dob = new Date(incomingDob);
    }
    if (!profile.phone && incomingPhone) {
      profile.phone = String(incomingPhone).trim();
    }
    if (!profile.profilePhoto && incomingProfilePhoto && String(incomingProfilePhoto).trim() !== '') {
      const photoValidation = validateWorkerProfilePhoto(incomingProfilePhoto);
      if (!photoValidation.valid) {
        return res.status(400).json({
          success: false,
          message: photoValidation.message,
        });
      }
      try {
        profile.profilePhoto = await saveBase64Image(String(incomingProfilePhoto).trim());
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Failed to process profile photo. Ensure it is a valid image.',
        });
      }
    }

    if (!profile.profilePhoto) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo is required for worker accounts.',
      });
    }

    // Allowed mutable fields
    if (location) {
      profile.location = String(location).trim();
    }
    if (bio !== undefined) {
      profile.bio = bio;
    }
    if (skills !== undefined) {
      profile.skills = Array.isArray(skills)
        ? skills
        : (typeof skills === 'string' ? skills.split(',').map((s) => s.trim()).filter(Boolean) : []);
    }
    if (experience !== undefined) {
      if (Array.isArray(experience)) {
        profile.experience = experience;
      } else if (typeof experience === 'string') {
        profile.experience = [{ title: 'Experience Summary', description: experience }];
      }
    }
    if (preferredEventTypes !== undefined && profile.availability) {
      const types = Array.isArray(preferredEventTypes)
        ? preferredEventTypes
        : (typeof preferredEventTypes === 'string' ? preferredEventTypes.split(',').map((s) => s.trim()).filter(Boolean) : []);
      profile.availability.preferredEventTypes = types;
    }

    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });
  } catch (error) {
    if (error.message && error.message.includes('cannot be changed after verification')) {
      return res.status(403).json({
        success: false,
        message: 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
      });
    }
    next(error);
  }
};


// Update worker availability schedule
exports.updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable, availableDates, unavailableDates, availableTimeSlots, preferredEventTypes } = req.body;

    let profile = await WorkerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    profile.availability = {
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : profile.availability.isAvailable,
      availableDates: Array.isArray(availableDates) ? availableDates.map((d) => new Date(d)) : profile.availability.availableDates,
      unavailableDates: Array.isArray(unavailableDates) ? unavailableDates.map((d) => new Date(d)) : profile.availability.unavailableDates,
      availableTimeSlots: Array.isArray(availableTimeSlots) ? availableTimeSlots : profile.availability.availableTimeSlots,
      preferredEventTypes: Array.isArray(preferredEventTypes) ? preferredEventTypes : profile.availability.preferredEventTypes,
    };

    await profile.save();

    res.json({
      success: true,
      message: 'Availability schedule updated successfully',
      availability: profile.availability,
    });
  } catch (error) {
    next(error);
  }
};

// Get Available Jobs (CRITICAL: Only APPROVED jobs, Payment masked to show ONLY Admin-Approved Payment!)
exports.getAvailableJobs = async (req, res, next) => {
  try {
    const { eventType, location, search, minPayment, date, page = 1, limit = 10 } = req.query;

    const query = {
      status: JOB_STATUS.APPROVED,
      acceptedAt: { $ne: null },
      isDeleted: { $ne: true },
    };

    if (eventType && eventType !== 'ALL') {
      query.eventType = eventType;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    if (minPayment) {
      query.adminApprovedPayment = { $gte: Number(minPayment) };
    }

    if (date) {
      const selectedDate = new Date(date);
      const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));
      query.eventDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const totalDocs = await Job.countDocuments(query);
    const jobsRaw = await Job.find(query)
      .sort({ createdAt: -1 }) // Show newest approved jobs first
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get current worker's applications to flag applied jobs
    // Workers see their application state regardless of whether Admin moved the application queue row to trash
    const myApplications = await Application.find({
      workerId: req.user._id,
    }).select('jobId status');
    const appliedJobMap = new Map(myApplications.map((app) => [app.jobId.toString(), app.status]));

    // Mask recruiter proposed payment for security & privacy rule
    const safeJobs = jobsRaw.map((job) => {
      const workerJob = job.toWorkerJSON();
      workerJob.hasApplied = appliedJobMap.has(job._id.toString());
      workerJob.myApplicationStatus = appliedJobMap.get(job._id.toString()) || null;
      return workerJob;
    });

    res.json({
      success: true,
      jobs: safeJobs,
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

// Get single job details for worker (payment masked)
exports.getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      status: JOB_STATUS.APPROVED,
      acceptedAt: { $ne: null },
      isDeleted: { $ne: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Approved job not found' });
    }

    const application = await Application.findOne({
      jobId: job._id,
      workerId: req.user._id,
    });

    const safeJob = job.toWorkerJSON();
    safeJob.hasApplied = !!application;
    safeJob.myApplicationStatus = application ? application.status : null;

    res.json({ success: true, job: safeJob });
  } catch (error) {
    next(error);
  }
};

// Apply for Job (goes to Admin queue)
exports.applyForJob = async (req, res, next) => {
  try {
    const jobId = req.params.id;

    const job = await Job.findOne({
      _id: jobId,
      status: JOB_STATUS.APPROVED,
      acceptedAt: { $ne: null },
      isDeleted: { $ne: true },
    });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job is not open for applications.' });
    }

    // Check if worker profile is complete
    const workerProfile = await WorkerProfile.findOne({ userId: req.user._id });
    if (!workerProfile || !workerProfile.profilePhoto) {
      return res.status(400).json({ success: false, message: 'Please complete your profile photo before applying for jobs.' });
    }

    // Check duplicate application
    const existingApp = await Application.findOne({ jobId: job._id, workerId: req.user._id });
    if (existingApp) {
      return res.status(400).json({ success: false, message: 'You have already applied for this job.' });
    }

    const application = await Application.create({
      jobId: job._id,
      workerId: req.user._id,
      status: APPLICATION_STATUS.APPLIED,
    });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.WORKER,
      action: 'APPLY_JOB',
      entityName: 'Application',
      entityId: application._id,
      notes: `Worker applied for job '${job.title}'`,
    });

    await createNotification({
      userId: req.user._id,
      title: 'Application Submitted',
      message: `Your application for '${job.title}' has been submitted and sent to Admin for review.`,
      type: 'APPLICATION_SUBMITTED',
      link: '/worker/applications',
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully to Admin queue.',
      application,
    });
  } catch (error) {
    next(error);
  }
};

// Get Worker's Applications
exports.getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ workerId: req.user._id })
      .populate('jobId')
      .sort({ createdAt: -1 });

    const safeApplications = applications.map((app) => {
      const appObj = app.toObject();
      if (appObj.jobId && appObj.jobId.recruiterProposedPayment !== undefined) {
        delete appObj.jobId.recruiterProposedPayment;
      }
      return appObj;
    });

    res.json({ success: true, applications: safeApplications });
  } catch (error) {
    next(error);
  }
};

// Get Worker's Assignments
exports.getMyAssignments = async (req, res, next) => {
  try {
    const assignments = await Assignment.find({ workerId: req.user._id })
      .populate('jobId')
      .sort({ createdAt: -1 });

    const safeAssignments = assignments.map((assign) => {
      const assignObj = assign.toObject();
      if (assignObj.jobId && assignObj.jobId.recruiterProposedPayment !== undefined) {
        delete assignObj.jobId.recruiterProposedPayment;
      }
      return assignObj;
    });

    res.json({ success: true, assignments: safeAssignments });
  } catch (error) {
    next(error);
  }
};

// Get Worker's Attendance records
exports.getMyAttendance = async (req, res, next) => {
  try {
    // IMPORTANT: Workers see ALL their attendance records regardless of isDeleted.
    // isDeleted is an Admin-only administrative lifecycle flag.
    const attendanceRecords = await Attendance.find({
      workerId: req.user._id,
    })
      .populate('jobId', 'title eventType eventDate location')
      .sort({ date: -1 });

    // CRITICAL BUSINESS INTEGRITY PROTECTION:
    // If Admin permanently deleted an Attendance record, the verified attendance
    // outcome must NOT be lost. Check completed or verified assignments to ensure
    // verified shift attendance is preserved.
    const existingAssignmentIds = new Set(
      attendanceRecords.map((a) => a.assignmentId?.toString()).filter(Boolean)
    );
    const settledOrCompletedAssignments = await Assignment.find({
      workerId: req.user._id,
      $or: [
        { status: ASSIGNMENT_STATUS.COMPLETED },
        { verifiedByAdminId: { $ne: null } },
        { 'paymentSettlement.status': 'PAID' },
      ],
    }).populate('jobId', 'title eventType eventDate location');

    const reconstructedAttendance = [];
    for (const assign of settledOrCompletedAssignments) {
      if (!existingAssignmentIds.has(assign._id.toString())) {
        reconstructedAttendance.push({
          _id: `verified-attendance-${assign._id}`,
          assignmentId: assign._id,
          jobId: assign.jobId,
          workerId: req.user._id,
          date: assign.jobId?.eventDate || assign.createdAt,
          status: ATTENDANCE_STATUS.PRESENT,
          verifiedByAdminId: assign.verifiedByAdminId || assign.assignedByAdminId,
          notes: 'Verified attendance preserved from event assignment.',
          createdAt: assign.createdAt,
          updatedAt: assign.updatedAt,
        });
      }
    }

    const allAttendance = [...attendanceRecords, ...reconstructedAttendance].sort(
      (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );

    res.json({ success: true, attendance: allAttendance });
  } catch (error) {
    next(error);
  }
};


// Get Worker's Payments (10-15 day timeline)
exports.getMyPayments = async (req, res, next) => {
  try {
    // IMPORTANT: Workers see ALL their payment records regardless of isDeleted.
    // isDeleted is an Admin-only administrative lifecycle flag.
    // A worker whose payment is PAID continues to see PAID even if Admin soft-deletes
    // or permanently deletes the admin-management record.
    // Note: After permanent deletion, the record is fully gone from MongoDB —
    // soft-deleted records (isDeleted=true) remain in DB and are still visible here.
    // 1. Fetch worker's payment records from Payment collection (including soft-deleted ones)
    const payments = await Payment.find({ workerId: req.user._id })
      .populate('jobId', 'title eventType eventDate location adminApprovedPayment')
      .select('-adminNotes -deletedByAdminId -permanentDeleteAt')
      .sort({ createdAt: -1 });

    // 2. CRITICAL BUSINESS RULE PROTECTION:
    // If Admin permanently deleted a PAID payment record, the completed business outcome
    // must NOT be reversed. The authoritative paymentSettlement on Assignment preserves it.
    const settledAssignments = await Assignment.find({
      workerId: req.user._id,
      'paymentSettlement.status': 'PAID',
    }).populate('jobId', 'title eventType eventDate location adminApprovedPayment');

    const existingAssignmentIds = new Set(
      payments.map((p) => p.assignmentId?.toString()).filter(Boolean)
    );

    const reconstructedPayments = [];
    for (const assign of settledAssignments) {
      if (!existingAssignmentIds.has(assign._id.toString())) {
        reconstructedPayments.push({
          _id: `settled-${assign._id}`,
          assignmentId: assign._id,
          jobId: assign.jobId,
          workerId: req.user._id,
          amount: assign.paymentSettlement?.amount || assign.jobId?.adminApprovedPayment || 0,
          status: 'PAID',
          paymentTimelineText: 'Expected payout timeline: 10–15 days after event verification',
          transactionRef: assign.paymentSettlement?.transactionRef || '',
          paidAt: assign.paymentSettlement?.paidAt || assign.updatedAt,
          expectedPaymentDate: assign.paymentSettlement?.paidAt || assign.updatedAt,
          createdAt: assign.createdAt,
          updatedAt: assign.updatedAt,
        });
      }
    }

    const allPayments = [...payments, ...reconstructedPayments].sort(
      (a, b) => new Date(b.createdAt || b.paidAt) - new Date(a.createdAt || a.paidAt)
    );

    const summary = {
      totalEarned: allPayments
        .filter((p) => p.status === 'PAID')
        .reduce((acc, p) => acc + (p.amount || 0), 0),
      pendingPayments: allPayments
        .filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING')
        .reduce((acc, p) => acc + (p.amount || 0), 0),
    };

    res.json({
      success: true,
      payments: allPayments,
      summary,
      timelineNotice: 'Worker payments are processed by Admin within 10–15 days of verified event completion.',
    });
  } catch (error) {
    next(error);
  }
};

// Request Assignment Cancellation via Admin
exports.requestAssignmentCancellation = async (req, res, next) => {
  try {
    const { reason, assignmentId } = req.body;

    const assignment = await Assignment.findOne({ _id: assignmentId, workerId: req.user._id });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const cancelReq = await CancellationRequest.create({
      requestedByUserId: req.user._id,
      requestedByRole: ROLES.WORKER,
      jobId: assignment.jobId,
      assignmentId: assignment._id,
      reason,
    });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.WORKER,
      action: 'REQUEST_ASSIGNMENT_CANCELLATION',
      entityName: 'Assignment',
      entityId: assignment._id,
      notes: `Worker requested assignment cancellation: ${reason}`,
    });

    res.json({
      success: true,
      message: 'Cancellation request submitted to Admin.',
      cancellationRequest: cancelReq,
    });
  } catch (error) {
    next(error);
  }
};
