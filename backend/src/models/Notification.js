const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: 'INFO',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    link: {
      type: String,
      default: '',
    },
    // Related entity for deep-link navigation
    relatedEntityType: {
      type: String,
      default: '',   // e.g. 'JOB', 'USER'
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for efficient "get unread for user" queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// Index for idempotency check in notificationService
notificationSchema.index({ userId: 1, type: 1, link: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
