const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const operationsController = require('../controllers/operationsController');

// All routes require authentication and OPERATIONS or ADMIN role
router.use(protect, requireRole(ROLES.OPERATIONS, ROLES.ADMIN));

// Dashboard
router.get('/dashboard', operationsController.getDashboardStats);

// Attendance
router.get('/attendance', operationsController.getAttendanceList);
router.patch('/attendance/:id', operationsController.updateAttendance);

// Events / Assignments
router.get('/events', operationsController.getEvents);
router.patch('/events/:id/complete', operationsController.completeEvent);

// Payments
router.get('/payments', operationsController.getPayments);
router.patch('/payments/:id', operationsController.updatePaymentStatus);

// Notifications
router.get('/notifications', operationsController.getNotifications);

// Audit History (Read Only)
router.get('/audit', operationsController.getAuditHistory);

module.exports = router;
