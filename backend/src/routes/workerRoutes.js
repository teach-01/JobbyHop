const express = require('express');
const {
  getProfile,
  updateProfile,
  updateAvailability,
  getAvailableJobs,
  getJobDetails,
  applyForJob,
  getMyApplications,
  getMyAssignments,
  getMyAttendance,
  getMyPayments,
  requestAssignmentCancellation,
} = require('../controllers/workerController');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect);
router.use(requireRole(ROLES.WORKER));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/availability', updateAvailability);

router.get('/jobs', getAvailableJobs);
router.get('/jobs/:id', getJobDetails);
router.post('/jobs/:id/apply', applyForJob);

router.get('/applications', getMyApplications);
router.get('/assignments', getMyAssignments);
router.get('/attendance', getMyAttendance);
router.get('/payments', getMyPayments);
router.post('/cancel-assignment-request', requestAssignmentCancellation);

module.exports = router;
