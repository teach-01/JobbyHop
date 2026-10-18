const mongoose = require('mongoose');
const { ASSIGNMENT_STATUS } = require('../config/constants');

const assignmentSchema = new mongoose.Schema(
  {
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
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ASSIGNED,
    },
    assignedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
    verifiedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    permanentDeleteAt: {
      type: Date,
      default: null,
    },
    // ── Payment Settlement State ─────────────────────────────────────────────
    // Authoritative completed payment outcome stored on the Assignment.
    // If the admin management payment record is permanently deleted, this
    // settlement outcome guarantees the worker still sees PAID / COMPLETED.
    paymentSettlement: {
      status: {
        type: String,
        default: null,
      },
      amount: {
        type: Number,
        default: null,
      },
      paidAt: {
        type: Date,
        default: null,
      },
      transactionRef: {
        type: String,
        default: '',
      },
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ jobId: 1, workerId: 1 }, { unique: true });
assignmentSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
