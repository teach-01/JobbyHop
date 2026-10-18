const Notification = require('../models/Notification');

const createNotification = async ({
  userId,
  title,
  message,
  type = 'INFO',
  link = '',
  relatedEntityType = '',
  relatedEntityId = null,
}) => {
  try {
    // Idempotency check: prevent duplicate notifications for the same event in a short time
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const existing = await Notification.findOne({
      userId,
      type,
      link,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (existing) {
      console.log('Skipping duplicate notification:', title);
      return existing;
    }

    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      link,
      relatedEntityType,
      relatedEntityId,
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
};

module.exports = {
  createNotification,
};
