const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// ── GET my notifications (unread only for the active list) ────────────────────
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// ── DELETE ALL notifications for current user ──────────────────────────────────
router.delete('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id });
    res.json({
      success: true,
      message: 'All notifications permanently deleted',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT mark single notification as read ─────────────────────────────────────
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
