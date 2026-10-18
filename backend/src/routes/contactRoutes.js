const express = require('express');
const { body, validationResult } = require('express-validator');
const { submitContactForm } = require('../controllers/contactController');

const router = express.Router();

/**
 * Custom validation response handler for contact submissions
 * providing friendly message format matching API standards.
 */
const handleContactValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: firstError?.msg || 'All fields are required.',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * POST /api/contact
 * Public endpoint — no authentication required.
 * Validates all required fields: name, email, role, subject, message.
 */
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 120 })
      .withMessage('Name must be 120 characters or fewer'),

    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email address is required')
      .isEmail()
      .withMessage('A valid email address is required')
      .normalizeEmail(),

    body('role')
      .trim()
      .notEmpty()
      .withMessage('Contacting as is required')
      .isIn(['WORKER', 'RECRUITER', 'OTHER'])
      .withMessage('Role must be WORKER, RECRUITER, or OTHER'),

    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ max: 200 })
      .withMessage('Subject must be 200 characters or fewer'),

    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 5000 })
      .withMessage('Message must be 5000 characters or fewer'),

    handleContactValidation,
  ],
  submitContactForm
);

module.exports = router;
