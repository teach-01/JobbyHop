const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    performedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    entityName: {
      type: String,
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },

    // ── Subject (the person the action was performed ON) ──────────────────
    // Captured at creation time so it survives entity deletion.
    subjectName: {
      type: String,
      default: '',
    },
    subjectRole: {
      type: String,
      default: '',
    },

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

// Compound index so the nightly cleanup query is fast
auditLogSchema.index({ isDeleted: 1, permanentDeleteAt: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
