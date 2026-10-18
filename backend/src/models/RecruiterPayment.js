const mongoose = require('mongoose');

const recruiterPaymentSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
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
      // PENDING   : Admin approved job, awaiting recruiter payment
      // PROCESSING: Recruiter submitted UTR, awaiting Admin verification
      // COMPLETED : Recruiter marked as done (auto-set on UTR submit if not going through review)
      // PAID      : Admin verified and confirmed payment received
      // REJECTED  : Admin rejected the submitted UTR/proof
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'PAID', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    utr: {
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
recruiterPaymentSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

// Virtual aliases for naming compatibility
recruiterPaymentSchema.virtual('utrNumber').get(function () {
  return this.utr;
});
recruiterPaymentSchema.virtual('recruiter').get(function () {
  return this.recruiterId;
});
recruiterPaymentSchema.virtual('job').get(function () {
  return this.jobId;
});
recruiterPaymentSchema.virtual('event').get(function () {
  return this.jobId;
});
recruiterPaymentSchema.virtual('recruiterPaymentStatus').get(function () {
  return this.status;
});
recruiterPaymentSchema.virtual('recruiterPaymentAmount').get(function () {
  return this.amount;
});
recruiterPaymentSchema.virtual('recruiterPaymentUTR').get(function () {
  return this.utr;
});
recruiterPaymentSchema.virtual('recruiterPaymentDate').get(function () {
  return this.paymentDate;
});
recruiterPaymentSchema.virtual('recruiterPaymentMethod').get(function () {
  return this.paymentMethod;
});
recruiterPaymentSchema.virtual('recruiterPaymentJobId').get(function () {
  return this.jobId;
});
recruiterPaymentSchema.virtual('recruiterPaymentRecruiterId').get(function () {
  return this.recruiterId;
});

module.exports = mongoose.model('RecruiterPayment', recruiterPaymentSchema);
