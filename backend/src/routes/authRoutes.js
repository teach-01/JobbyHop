const express = require('express');
const { body } = require('express-validator');
const {
  registerRecruiter,
  registerWorker,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  logout,
  forceChangePassword,
  deleteCurrentUser,
} = require('../controllers/authController');
const { sendEmailOtp, verifyEmailOtp } = require('../controllers/otpController');
const {
  googleRegisterWorker,
  googleRegisterRecruiter,
  googleLogin,
  googleVerifyOnly,
} = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ── Normal (password-based) registration ──────────────────────────────────

router.post(
  '/register/recruiter',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
  ],
  registerRecruiter
);

router.post(
  '/register/worker',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('profilePhoto').notEmpty().withMessage('Profile photo is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('dob').notEmpty().withMessage('Date of birth is required'),
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
  ],
  registerWorker
);

// ── Normal login ───────────────────────────────────────────────────────────

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('expectedRole').optional().isString(),
    validate,
  ],
  login
);

// ── Session / account management ──────────────────────────────────────────

router.get('/me', protect, getCurrentUser);
router.delete('/me', protect, deleteCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.post('/force-change-password', protect, forceChangePassword);

// ── Email OTP verification ─────────────────────────────────────────────────

router.post(
  '/send-email-otp',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    validate,
  ],
  sendEmailOtp
);

router.post(
  '/verify-email-otp',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    validate,
  ],
  verifyEmailOtp
);

// ── Google OAuth routes ────────────────────────────────────────────────────
// These endpoints accept a Google ID token (from the frontend Google Sign-In)
// and the manually-entered form data (registration) or expectedRole (login).
//
// Role is determined by the backend endpoint — never trusted from frontend.

// Verify Google token only (returns email — used to confirm email match before submit)
router.post(
  '/google/verify-only',
  [
    body('idToken').notEmpty().withMessage('Google ID token is required'),
    validate,
  ],
  googleVerifyOnly
);

// Google-assisted Worker registration (Google = email verification only)
router.post(
  '/google/register/worker',
  [
    body().custom((val, { req }) => {
      if (!req.body.idToken && !req.body.registrationToken) {
        throw new Error('Google idToken or registrationToken is required');
      }
      return true;
    }),
    body('formData').isObject().withMessage('formData must be an object'),
    validate,
  ],
  googleRegisterWorker
);

// Google-assisted Recruiter registration (Google = email verification only)
router.post(
  '/google/register/recruiter',
  [
    body().custom((val, { req }) => {
      if (!req.body.idToken && !req.body.registrationToken) {
        throw new Error('Google idToken or registrationToken is required');
      }
      return true;
    }),
    body('formData').isObject().withMessage('formData must be an object'),
    validate,
  ],
  googleRegisterRecruiter
);

// Google login (finds existing linked account and issues JWT)
router.post(
  '/google/login',
  [
    body('idToken').notEmpty().withMessage('Google ID token is required'),
    body('expectedRole').optional().isString(),
    validate,
  ],
  googleLogin
);

module.exports = router;
