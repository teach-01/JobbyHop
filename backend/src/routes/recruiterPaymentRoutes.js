const express = require('express');
const {
  getMyPayments,
  submitPayment,
  getPaymentById,
  getAllRecruiterPayments,
  updatePaymentStatus,
  getTrashRecruiterPayments,
  softDeleteRecruiterPayment,
  restoreRecruiterPayment,
  permanentDeleteRecruiterPayment,
  bulkSoftDeleteRecruiterPayments,
  bulkRestoreRecruiterPayments,
  bulkPermanentDeleteRecruiterPayments,
} = require('../controllers/recruiterPaymentController');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

// Recruiter specific endpoints
router.get('/my-payments', protect, requireRole(ROLES.RECRUITER), getMyPayments);
router.post('/:id/submit', protect, requireRole(ROLES.RECRUITER), submitPayment);

// Admin specific endpoints (accessible via /api/admin/recruiter-payments or /api/admin/recruiter-collections)
router.get('/admin', protect, requireRole(ROLES.ADMIN), getAllRecruiterPayments);
router.get('/', protect, requireRole(ROLES.ADMIN), getAllRecruiterPayments);
router.get('/trash', protect, requireRole(ROLES.ADMIN), getTrashRecruiterPayments);

// Bulk endpoints (Admin Only)
router.post('/bulk/delete', protect, requireRole(ROLES.ADMIN), bulkSoftDeleteRecruiterPayments);
router.post('/bulk/restore', protect, requireRole(ROLES.ADMIN), bulkRestoreRecruiterPayments);
router.post('/bulk/permanent-delete', protect, requireRole(ROLES.ADMIN), bulkPermanentDeleteRecruiterPayments);

// Status and Trash lifecycle endpoints
router.patch('/:id/status', protect, requireRole(ROLES.ADMIN), updatePaymentStatus);
router.put('/:id/status', protect, requireRole(ROLES.ADMIN), updatePaymentStatus);
router.delete('/:id', protect, requireRole(ROLES.ADMIN), softDeleteRecruiterPayment);
router.post('/:id/restore', protect, requireRole(ROLES.ADMIN), restoreRecruiterPayment);
router.patch('/:id/restore', protect, requireRole(ROLES.ADMIN), restoreRecruiterPayment);
router.delete('/:id/permanent', protect, requireRole(ROLES.ADMIN), permanentDeleteRecruiterPayment);

// Get single payment details (Recruiter can view own; Admin can view any)
router.get('/:id', protect, getPaymentById);

module.exports = router;

