const mongoose = require('mongoose');
const { JOB_STATUS, EVENT_TYPES } = require('../config/constants');

const jobSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: [true, 'Event type is required'],
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
    },
    location: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Location is required'],
      validate: {
        validator: function (v) {
          if (typeof v === 'string') {
            return v.trim().length > 0;
          }
          if (typeof v === 'object' && v !== null) {
            return (
              typeof v.address === 'string' &&
              v.address.trim().length > 0 &&
              typeof v.latitude === 'number' &&
              v.latitude >= -90 && v.latitude <= 90 &&
              typeof v.longitude === 'number' &&
              v.longitude >= -180 && v.longitude <= 180
            );
          }
          return false;
        },
        message: 'Location must be a valid string or a structured object with address, latitude, and longitude.',
      },
    },
    workersRequired: {
      type: Number,
      required: [true, 'Number of workers required is required'],
      min: 1,
    },
    assignedWorkersCount: {
      type: Number,
      default: 0,
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    workerRequirements: {
      type: String,
      default: '',
    },
    responsibilities: {
      type: String,
      default: '',
    },
    additionalInstructions: {
      type: String,
      default: '',
    },
    recruiterProposedPayment: {
      type: Number,
      required: [true, 'Proposed payment is required'],
      min: 0,
    },
    adminApprovedPayment: {
      type: Number,
      default: null,
    },
    recruiterPaymentAmount: {
      type: Number,
      default: null,
    },
    recruiterPaymentStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'PROCESSING', 'COMPLETED', 'PAID', 'REJECTED', null, ''],
        message: '{VALUE} is not a valid recruiter payment status',
      },
      default: null,
    },

    // ── Immutable Payment Offer Snapshot ────────────────────────────────────
    // Captured at job submission time. Never changes even if recruiter edits
    // anything later. This is the auditable proof of what the recruiter offered.
    offeredAmountPerPerson: {
      type: Number,
      default: null,
    },
    offeredTotalAmount: {
      type: Number,
      default: null,
    },
    offeredAmountCapturedAt: {
      type: Date,
      default: null,
    },

    // ── Acceptance Proof ────────────────────────────────────────────────────
    // Set when Admin accepts/approves the job request.
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Event Completion Proof ──────────────────────────────────────────────
    // Set when Admin marks event as completed.
    completedAt: {
      type: Date,
      default: null,
    },
    completedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.PENDING_REVIEW,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    permanentDeleteAt: Date,
    recruiterCollectionPermanentlyDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Method to return worker-safe view (strip all internal payment/admin fields)
jobSchema.methods.toWorkerJSON = function () {
  const obj = this.toObject();
  // Strip recruiter payment offer — workers only see adminApprovedPayment
  delete obj.recruiterProposedPayment;
  delete obj.adminNotes;
  delete obj.reviewedByAdminId;
  // Strip immutable offer snapshot — Admin-only data
  delete obj.offeredAmountPerPerson;
  delete obj.offeredTotalAmount;
  delete obj.offeredAmountCapturedAt;
  // Strip acceptance & completion admin IDs — Admin-only data
  delete obj.acceptedByAdminId;
  delete obj.completedByAdminId;
  return obj;
};

// Compound index for efficient 30-day trash cleanup
jobSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

module.exports = mongoose.model('Job', jobSchema);
