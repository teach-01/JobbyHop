const express = require('express');
const { getProfile, updateProfile, submitJob, getMyJobs, getJobDetails, requestJobCancellation, getPaymentSummary } = require('../controllers/recruiterController');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect);
router.use(requireRole(ROLES.RECRUITER));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/jobs', submitJob);
router.get('/jobs', getMyJobs);
router.get('/jobs/:id', getJobDetails);
router.post('/jobs/:id/cancel-request', requestJobCancellation);
router.get('/payment-summary', getPaymentSummary);
router.post('/recruiter-collections', require('../controllers/recruiterCollectionController').submitCollectionPayment);
router.post('/recruiter-payments', require('../controllers/recruiterPaymentController').submitPayment);

module.exports = router;
