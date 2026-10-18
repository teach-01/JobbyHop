const mongoose = require('mongoose');
const { APPLICATION_STATUS } = require('../config/constants');

const applicationSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.APPLIED,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
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

    // ── Soft-Delete / Trash lifecycle ──────────────────────────────────────
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
  },
  { timestamps: true }
);

// Prevent duplicate active applications per job/worker
applicationSchema.index({ jobId: 1, workerId: 1 }, { unique: true });

// Compound index for efficient 30-day trash cleanup
applicationSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

module.exports = mongoose.model('Application', applicationSchema);
