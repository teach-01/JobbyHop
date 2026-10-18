const express = require('express');
const {
  getMyCollections,
  submitCollectionPayment,
  getCollectionById,
  getAllRecruiterCollections,
  updateCollectionStatus,
  getTrashRecruiterCollections,
  softDeleteRecruiterCollection,
  restoreRecruiterCollection,
  permanentDeleteRecruiterCollection,
  bulkSoftDeleteRecruiterCollections,
  bulkRestoreRecruiterCollections,
  bulkPermanentDeleteRecruiterCollections,
} = require('../controllers/recruiterCollectionController');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

// ── Recruiter Endpoints ─────────────────────────────────────────────────────
router.get('/my-collections', protect, requireRole(ROLES.RECRUITER), getMyCollections);
router.get('/my-payments', protect, requireRole(ROLES.RECRUITER), getMyCollections);
router.post('/submit', protect, requireRole(ROLES.RECRUITER), submitCollectionPayment);
router.post('/:id/submit', protect, requireRole(ROLES.RECRUITER), submitCollectionPayment);
router.post('/', protect, requireRole(ROLES.RECRUITER), submitCollectionPayment);

// ── Admin Endpoints ─────────────────────────────────────────────────────────
router.get('/admin', protect, requireRole(ROLES.ADMIN), getAllRecruiterCollections);
router.get('/', protect, requireRole(ROLES.ADMIN), getAllRecruiterCollections);
router.get('/trash', protect, requireRole(ROLES.ADMIN), getTrashRecruiterCollections);

// Bulk endpoints (Admin Only)
router.post('/bulk/delete', protect, requireRole(ROLES.ADMIN), bulkSoftDeleteRecruiterCollections);
router.post('/bulk/restore', protect, requireRole(ROLES.ADMIN), bulkRestoreRecruiterCollections);
router.post('/bulk/permanent-delete', protect, requireRole(ROLES.ADMIN), bulkPermanentDeleteRecruiterCollections);

// Status and Trash lifecycle endpoints
router.patch('/:id/status', protect, requireRole(ROLES.ADMIN), updateCollectionStatus);
router.put('/:id/status', protect, requireRole(ROLES.ADMIN), updateCollectionStatus);
router.delete('/:id', protect, requireRole(ROLES.ADMIN), softDeleteRecruiterCollection);
router.post('/:id/restore', protect, requireRole(ROLES.ADMIN), restoreRecruiterCollection);
router.patch('/:id/restore', protect, requireRole(ROLES.ADMIN), restoreRecruiterCollection);
router.delete('/:id/permanent', protect, requireRole(ROLES.ADMIN), permanentDeleteRecruiterCollection);

// ── Single Item Lookup (Recruiter can view own, Admin can view any) ─────────
router.get('/:id', protect, getCollectionById);

module.exports = router;
