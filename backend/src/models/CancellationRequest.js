const mongoose = require('mongoose');
const { CANCELLATION_STATUS, ROLES } = require('../config/constants');

const cancellationRequestSchema = new mongoose.Schema(
  {
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedByRole: {
      type: String,
      enum: [ROLES.RECRUITER, ROLES.WORKER],
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
    },
    reason: {
      type: String,
      required: [true, 'Cancellation reason is required'],
    },
    status: {
      type: String,
      enum: Object.values(CANCELLATION_STATUS),
      default: CANCELLATION_STATUS.PENDING,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    handledByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    handledAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('CancellationRequest', cancellationRequestSchema);
