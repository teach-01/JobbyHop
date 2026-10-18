const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentTimelineText: {
      type: String,
      default: 'Expected payout timeline: 10–15 days after event verification',
    },
    expectedPaymentDate: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'Bank Transfer / UPI',
    },
    transactionRef: {
      type: String,
      default: '',
    },
    processedAt: Date,
    paidAt: Date,
    adminNotes: {
      type: String,
      default: '',
    },
    verifiedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ── Administrative Trash Lifecycle ────────────────────────────────────────
    // These fields are SEPARATE from the payment business state.
    // Soft-deleting a payment record NEVER changes the payment status (PAID, PENDING, etc.)
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
  { timestamps: true }
);

// Index for the 30-day cleanup query
paymentSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
