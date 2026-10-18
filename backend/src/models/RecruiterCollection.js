const mongoose = require('mongoose');

const recruiterCollectionSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      unique: true, // One recruiter collection record per job/event
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Collection amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    perPersonRate: {
      type: Number,
      default: null,
    },
    verifiedAttendeesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PAID', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    utrNumber: {
      type: String,
      trim: true,
      default: '',
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Bank Transfer', 'Other', ''],
      default: '',
    },
    paymentProof: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },

    // ── Administrative Trash Lifecycle ────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    permanentDeleteAt: {
      type: Date,
      default: null,
    },
    deletedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for 30-day trash cleanup
recruiterCollectionSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

// Virtual aliases for schema compatibility
recruiterCollectionSchema.virtual('recruiter').get(function () {
  return this.recruiterId;
});
recruiterCollectionSchema.virtual('job').get(function () {
  return this.jobId;
});
recruiterCollectionSchema.virtual('event').get(function () {
  return this.jobId;
});

// Additional aliases for payment terminology compatibility
recruiterCollectionSchema.virtual('utr').get(function () {
  return this.utrNumber;
});
recruiterCollectionSchema.virtual('recruiterPaymentStatus').get(function () {
  return this.status;
});
recruiterCollectionSchema.virtual('recruiterPaymentAmount').get(function () {
  return this.amount;
});
recruiterCollectionSchema.virtual('recruiterPaymentUTR').get(function () {
  return this.utrNumber;
});
recruiterCollectionSchema.virtual('recruiterPaymentDate').get(function () {
  return this.paymentDate;
});
recruiterCollectionSchema.virtual('recruiterPaymentMethod').get(function () {
  return this.paymentMethod;
});

module.exports = mongoose.model('RecruiterCollection', recruiterCollectionSchema);
