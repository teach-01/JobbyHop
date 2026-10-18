const express = require('express');
const {
  getDashboardStats,
  getEventStats,
  getJobRequests,
  reviewJobRequest,
  getApplications,
  approveAndAssignWorker,
  rejectApplication,
  softDeleteApplication,
  getTrashApplications,
  restoreApplication,
  permanentDeleteApplication,
  softDeleteJob,
  getTrashJobs,
  restoreJob,
  permanentDeleteJob,
  getAttendanceList,
  updateAttendance,
  softDeleteAttendance,
  getTrashAttendance,
  restoreAttendance,
  permanentDeleteAttendance,
  completeEvent,
  reopenEvent,
  getPayments,
  updatePaymentStatus,
  softDeletePayment,
  getTrashPayments,
  restorePayment,
  permanentDeletePayment,
  getCancellationRequests,
  handleCancellationRequest,
  getAllRecruiters,
  getAllWorkers,
  getUserById,
  deleteUser,
  updateUserStatus,
  resetUserPassword,
  forceUserPasswordChange,
  getUserHistory,
  getAuditLogs,
  softDeleteAuditLog,
  getTrashAuditLogs,
  restoreAuditLog,
  permanentDeleteAuditLog,
  getAllAssignments,
  getTrashAssignments,
  softDeleteAssignment,
  restoreAssignment,
  permanentDeleteAssignment,
  updateApplicationStatus,
  updateAssignmentStatus,
  updateUserRating,
  // ── Bulk Actions ─────────────────────────────────────────────────────────────
  bulkSoftDeleteJobs,
  bulkRestoreJobs,
  bulkPermanentDeleteJobs,
  bulkSoftDeleteApplications,
  bulkRestoreApplications,
  bulkPermanentDeleteApplications,
  bulkSoftDeleteAssignments,
  bulkRestoreAssignments,
  bulkPermanentDeleteAssignments,
  bulkSoftDeleteAttendance,
  bulkRestoreAttendance,
  bulkPermanentDeleteAttendance,
  bulkRestoreAuditLogs,
  bulkPermanentDeleteAuditLogs,
  bulkSoftDeleteAuditLogs,
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect);
router.use(requireRole(ROLES.ADMIN));

router.get('/dashboard-stats', getDashboardStats);
router.get('/events/stats', getEventStats);

router.get('/job-requests', getJobRequests);
router.put('/jobs/:id/review', reviewJobRequest);
router.get('/jobs/trash', getTrashJobs);
router.delete('/jobs/:id', softDeleteJob);
router.patch('/jobs/:id/restore', restoreJob);
router.delete('/jobs/:id/permanent', permanentDeleteJob);
// Bulk job routes
router.post('/jobs/bulk/delete', bulkSoftDeleteJobs);
router.post('/jobs/bulk/restore', bulkRestoreJobs);
router.post('/jobs/bulk/permanent-delete', bulkPermanentDeleteJobs);

router.get('/applications', getApplications);
router.get('/applications/trash', getTrashApplications);
router.delete('/applications/:id/permanent', permanentDeleteApplication);
router.delete('/applications/:id', softDeleteApplication);
router.patch('/applications/:id/restore', restoreApplication);
router.post('/applications/approve-assign', approveAndAssignWorker);
router.post('/applications/reject', rejectApplication);
router.put('/applications/:id/status', updateApplicationStatus);
// Bulk application routes
router.post('/applications/bulk/delete', bulkSoftDeleteApplications);
router.post('/applications/bulk/restore', bulkRestoreApplications);
router.post('/applications/bulk/permanent-delete', bulkPermanentDeleteApplications);

router.get('/assignments', getAllAssignments);
router.get('/assignments/trash', getTrashAssignments);
router.delete('/assignments/:id', softDeleteAssignment);
router.patch('/assignments/:id/restore', restoreAssignment);
router.delete('/assignments/:id/permanent', permanentDeleteAssignment);
router.put('/assignments/:id/status', updateAssignmentStatus);
// Bulk assignment routes
router.post('/assignments/bulk/delete', bulkSoftDeleteAssignments);
router.post('/assignments/bulk/restore', bulkRestoreAssignments);
router.post('/assignments/bulk/permanent-delete', bulkPermanentDeleteAssignments);

router.get('/attendance', getAttendanceList);
router.put('/attendance/update', updateAttendance);
router.get('/attendance/trash', getTrashAttendance);
router.delete('/attendance/:id', softDeleteAttendance);
router.patch('/attendance/:id/restore', restoreAttendance);
router.delete('/attendance/:id/permanent', permanentDeleteAttendance);
// Bulk attendance routes
router.post('/attendance/bulk/delete', bulkSoftDeleteAttendance);
router.post('/attendance/bulk/restore', bulkRestoreAttendance);
router.post('/attendance/bulk/permanent-delete', bulkPermanentDeleteAttendance);

router.post('/events/:id/complete', completeEvent);
router.post('/events/:id/reopen', reopenEvent);

router.get('/payments', getPayments);
router.put('/payments/status', updatePaymentStatus);
router.get('/payments/trash', getTrashPayments);
router.delete('/payments/:id', softDeletePayment);
router.patch('/payments/:id/restore', restorePayment);
router.delete('/payments/:id/permanent', permanentDeletePayment);

router.get('/cancellations', getCancellationRequests);
router.post('/cancellations/handle', handleCancellationRequest);

router.get('/recruiters', getAllRecruiters);
router.get('/workers', getAllWorkers);
router.get('/users/:id', getUserById);
router.delete('/users/:id', deleteUser);
router.post('/users/status', updateUserStatus);
router.put('/users/:id/rating', updateUserRating);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:id/force-password-change', forceUserPasswordChange);
router.get('/users/:id/history', getUserHistory);
router.get('/audit-logs', getAuditLogs);
router.get('/audit-logs/trash', getTrashAuditLogs);
router.delete('/audit-logs/:id', softDeleteAuditLog);
router.patch('/audit-logs/:id/restore', restoreAuditLog);
router.delete('/audit-logs/:id/permanent', permanentDeleteAuditLog);
// Bulk audit log routes
router.post('/audit-logs/bulk/delete', bulkSoftDeleteAuditLogs);
router.post('/audit-logs/bulk/restore', bulkRestoreAuditLogs);
router.post('/audit-logs/bulk/permanent-delete', bulkPermanentDeleteAuditLogs);

module.exports = router;
