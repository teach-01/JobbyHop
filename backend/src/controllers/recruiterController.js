const RecruiterProfile = require('../models/RecruiterProfile');
const Job = require('../models/Job');
const CancellationRequest = require('../models/CancellationRequest');
const { createNotification } = require('../services/notificationService');
const { logAuditEvent } = require('../services/auditService');
const { JOB_STATUS, ROLES } = require('../config/constants');
const { validateWorkerProfilePhoto } = require('../utils/imageValidator');
const { saveBase64Image } = require('../utils/imageStorage');

const sanitizeJobForRecruiter = (job) => {
  const obj = typeof job.toObject === 'function' ? job.toObject() : job;
  
  // ── Recruiter's original requested rate (NEVER overwritten by admin) ──────
  // This is the rate the recruiter proposed at submission time.
  // Fallback chain: immutable snapshot → original field
  obj.recruiterRequestedRate = obj.offeredAmountPerPerson ?? obj.recruiterProposedPayment;

  // Recruiter → Admin Payment amount & status (for the event)
  obj.recruiterPaymentAmount = obj.recruiterPaymentAmount ?? obj.offeredTotalAmount ?? (obj.recruiterRequestedRate * obj.workersRequired);
  obj.recruiterPaymentStatus = obj.recruiterPaymentStatus ?? 'PENDING';
    
  // Delete all internal payment fields and admin notes — recruiter must not
  // see raw admin internals, worker payout decisions, or admin approved rates.
  delete obj.recruiterProposedPayment;
  delete obj.adminApprovedPayment;
  delete obj.finalWorkerPayout;
  delete obj.hasAdminApprovedRate;
  // Expose rejection reason if rejected
  if (obj.status === 'REJECTED') {
    obj.rejectionReason = obj.adminNotes || 'No specific reason provided by Admin.';
  }

  delete obj.adminNotes;
  delete obj.reviewedByAdminId;
  // Strip Admin-only immutable offer snapshot and acceptance proof
  delete obj.offeredAmountPerPerson;
  delete obj.offeredTotalAmount;
  delete obj.offeredAmountCapturedAt;
  delete obj.acceptedByAdminId;
  
  return obj;
};

// Get recruiter profile
exports.getProfile = async (req, res, next) => {
  try {
    const profile = await RecruiterProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Recruiter profile not found' });
    }
    const profileObj = profile.toObject();
    profileObj.email = profileObj.email || req.user.email;
    res.json({ success: true, profile: profileObj });
  } catch (error) {
    next(error);
  }
};

// Update recruiter profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, location, phone, companyDescription, companyLogo, logo, businessExperience } = req.body;

    let profile = await RecruiterProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Company Name, Email, Contact Person Name, and Phone Number are strictly locked and cannot be changed from Company Profile
    // (Incoming req.body.companyName, req.body.email, req.body.fullName, and req.body.phone are intentionally ignored)

    if (!profile.isInitialSetupComplete) {
      const incomingLogo = companyLogo !== undefined ? companyLogo : logo;
      if (incomingLogo !== undefined && String(incomingLogo).trim() !== '') {
        const logoValidation = validateWorkerProfilePhoto(incomingLogo);
        if (!logoValidation.valid) {
          return res.status(400).json({ success: false, message: logoValidation.message });
        }
        try {
          profile.companyLogo = await saveBase64Image(String(incomingLogo).trim());
        } catch (err) {
          return res.status(400).json({ success: false, message: 'Failed to process company logo. Ensure it is a valid image.' });
        }
      }
      
      profile.isInitialSetupComplete = true; // Lock immutable fields
    }

    if (location) profile.location = location;
    if (companyDescription !== undefined) profile.companyDescription = companyDescription;
    if (businessExperience !== undefined) profile.businessExperience = businessExperience;

    await profile.save();

    const profileObj = profile.toObject();
    profileObj.email = profileObj.email || req.user.email;

    res.json({ success: true, message: 'Profile updated successfully', profile: profileObj });
  } catch (error) {
    next(error);
  }
};

// Submit Job Request (PENDING_REVIEW)
exports.submitJob = async (req, res, next) => {
  try {
    const {
      title,
      description,
      eventType,
      eventDate,
      startTime,
      endTime,
      location,
      latitude,
      longitude,
      workersRequired,
      requiredSkills,
      workerRequirements,
      responsibilities,
      recruiterProposedPayment,
      additionalInstructions,
    } = req.body;

    // Validate and parse payment/worker counts on backend (never trust frontend)
    const parsedWorkersRequired = Number(workersRequired);
    const parsedProposedPayment = Number(recruiterProposedPayment);

    if (!parsedWorkersRequired || parsedWorkersRequired < 1) {
      return res.status(400).json({ success: false, message: 'Workers required must be at least 1.' });
    }
    if (isNaN(parsedProposedPayment) || parsedProposedPayment < 0) {
      return res.status(400).json({ success: false, message: 'Proposed payment per person must be a valid non-negative number.' });
    }

    if (!location || (typeof location === 'string' && location.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Location address is required.' });
    }
    const hasCoordinates = (latitude !== undefined && latitude !== null && latitude !== '') || 
                           (longitude !== undefined && longitude !== null && longitude !== '');
    if (hasCoordinates) {
      const numLat = Number(latitude);
      const numLon = Number(longitude);
      if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        return res.status(400).json({ success: false, message: 'Valid location coordinates are required. Please search and select a location from the map.' });
      }
    }

    // Capture immutable offer snapshot at submission time.
    // This is permanent proof of what recruiter offered when submitting.
    // It NEVER changes even if recruiter later modifies job or payment info.
    const captureTimestamp = new Date();
    const offeredTotal = parsedProposedPayment * parsedWorkersRequired;

    const job = await Job.create({
      recruiterId: req.user._id,
      title,
      description,
      eventType,
      eventDate: new Date(eventDate),
      startTime,
      endTime,
      location: (typeof latitude === 'number' && typeof longitude === 'number') 
        ? { address: (typeof location === 'object' && location?.address) ? location.address : location, latitude, longitude } 
        : (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && latitude !== null && longitude !== null && latitude !== '' && longitude !== '')
          ? { address: (typeof location === 'object' && location?.address) ? location.address : location, latitude: Number(latitude), longitude: Number(longitude) }
          : location,
      workersRequired: parsedWorkersRequired,
      requiredSkills: Array.isArray(requiredSkills)
        ? requiredSkills
        : (requiredSkills ? requiredSkills.split(',').map((s) => s.trim()) : []),
      workerRequirements: workerRequirements || '',
      responsibilities: responsibilities || '',
      recruiterProposedPayment: parsedProposedPayment,
      additionalInstructions: additionalInstructions || '',
      status: JOB_STATUS.PENDING_REVIEW,
      // \u2500\u2500 Immutable offer snapshot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      offeredAmountPerPerson: parsedProposedPayment,
      offeredTotalAmount: offeredTotal,
      offeredAmountCapturedAt: captureTimestamp,
    });

    // Increment total jobs submitted in profile
    await RecruiterProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $inc: { totalJobsSubmitted: 1 } }
    );

    // Audit log — REQUEST_CREATED event with full offer snapshot
    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.RECRUITER,
      action: 'REQUEST_CREATED',
      entityName: 'Job',
      entityId: job._id,
      newValue: {
        title,
        status: JOB_STATUS.PENDING_REVIEW,
        workersRequired: parsedWorkersRequired,
        offeredAmountPerPerson: parsedProposedPayment,
        offeredTotalAmount: offeredTotal,
        offeredAmountCapturedAt: captureTimestamp,
      },
      notes: `Recruiter submitted new event job request for Admin review. Offer: ₹${parsedProposedPayment}/person × ${parsedWorkersRequired} = ₹${offeredTotal} total.`,
    });

    // Notify Recruiter
    await createNotification({
      userId: req.user._id,
      title: 'Job Request Submitted',
      message: `Your job request '${job.title}' has been submitted and is currently pending Admin review.`,
      type: 'JOB_SUBMITTED',
      link: `/recruiter/submitted-events/${job._id}`,
    });

    res.status(201).json({
      success: true,
      message: 'Job request submitted successfully. It will be reviewed by Admin shortly.',
      job: sanitizeJobForRecruiter(job),
    });
  } catch (error) {
    next(error);
  }
};

// Get Recruiter's Jobs
exports.getMyJobs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const query = { recruiterId: req.user._id };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const totalDocs = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Stats breakdown
    const stats = {
      totalSubmitted: await Job.countDocuments({ recruiterId: req.user._id }),
      pendingReview: await Job.countDocuments({ recruiterId: req.user._id, status: JOB_STATUS.PENDING_REVIEW }),
      approved: await Job.countDocuments({ recruiterId: req.user._id, status: JOB_STATUS.APPROVED }),
      rejected: await Job.countDocuments({ recruiterId: req.user._id, status: JOB_STATUS.REJECTED }),
      completed: await Job.countDocuments({ recruiterId: req.user._id, status: JOB_STATUS.COMPLETED }),
    };

    res.json({
      success: true,
      jobs: jobs.map(sanitizeJobForRecruiter),
      stats,
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

// Get Job Details for Recruiter
exports.getJobDetails = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const job = await Job.findOne({ _id: req.params.id, recruiterId: req.user._id });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, job: sanitizeJobForRecruiter(job) });
  } catch (error) {
    next(error);
  }
};

// Request Cancellation via Admin
exports.requestJobCancellation = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const jobId = req.params.id;

    const job = await Job.findOne({ _id: jobId, recruiterId: req.user._id });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const cancelReq = await CancellationRequest.create({
      requestedByUserId: req.user._id,
      requestedByRole: ROLES.RECRUITER,
      jobId: job._id,
      reason,
    });

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: ROLES.RECRUITER,
      action: 'REQUEST_CANCELLATION',
      entityName: 'Job',
      entityId: job._id,
      notes: `Recruiter requested cancellation: ${reason}`,
    });

    res.json({
      success: true,
      message: 'Cancellation request submitted to Admin for approval.',
      cancellationRequest: cancelReq,
    });
  } catch (error) {
    next(error);
  }
};

// Get Recruiter Payment Summary (Worker payouts hidden from recruiters)
exports.getPaymentSummary = async (req, res, next) => {
  try {
    // Admin-to-Worker payouts are strictly private to Admin and Workers.
    // Recruiter-facing payment summary returns null data to ensure complete data separation.
    res.json({
      success: true,
      data: null
    });
  } catch (error) {
    next(error);
  }
};
