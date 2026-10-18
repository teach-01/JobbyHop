const crypto = require('crypto');
const OtpStore = require('../models/OtpStore');
const { sendOtpEmail } = require('../services/emailService');

// ── Constants ──────────────────────────────────────────────────────────────
const OTP_EXPIRY_MS = 5 * 60 * 1000;       // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;       // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;              // lock after 5 wrong guesses

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure 6-digit numeric OTP */
function generateOtp() {
  // crypto.randomInt gives a uniform int in [min, max)
  const n = crypto.randomInt(100000, 1000000);
  return String(n);
}

/** SHA-256 hash of the OTP (never store plaintext) */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-email-otp
 * Body: { email }
 *
 * Generates a new OTP, sends it by email, and stores the hash.
 * Invalidates any previous OTP for this email.
 * Enforces 60-second resend cooldown.
 */
exports.sendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Check resend cooldown ──────────────────────────────────────────────
    const existing = await OtpStore.findOne({ email: normalizedEmail });
    if (existing) {
      const msSinceSent = Date.now() - new Date(existing.lastSentAt).getTime();
      if (msSinceSent < RESEND_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - msSinceSent) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secondsLeft} seconds before requesting a new code.`,
          secondsLeft,
        });
      }
    }

    // ── Generate OTP ──────────────────────────────────────────────────────
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // ── Upsert – overwrites previous OTP for this email ───────────────────
    await OtpStore.findOneAndUpdate(
      { email: normalizedEmail },
      {
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        verified: false,
      },
      { upsert: true, new: true }
    );

    // ── Send email (real SMTP – no console OTP, no mock) ──────────────────
    await sendOtpEmail(normalizedEmail, otp);
    // otp variable goes out of scope here – never stored in plaintext

    return res.json({
      success: true,
      message: 'Verification code sent to your email. It expires in 5 minutes.',
      // ⚠ OTP is NEVER returned in the response
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-email-otp
 * Body: { email, otp }
 *
 * Verifies the submitted OTP against the stored hash.
 * Enforces max-attempts lockout and expiry.
 * Does NOT complete registration – that remains in registerRecruiter / registerWorker.
 * Sets verified=true so the register endpoints can check it.
 */
exports.verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpRecord = await OtpStore.findOne({ email: normalizedEmail });

    // ── No OTP record ──────────────────────────────────────────────────────
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'No verification code found for this email. Please request a new one.' });
    }

    // ── Already verified ───────────────────────────────────────────────────
    if (otpRecord.verified) {
      return res.json({ success: true, message: 'Email already verified. You may complete registration.' });
    }

    // ── Expired ───────────────────────────────────────────────────────────
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    // ── Too many attempts ──────────────────────────────────────────────────
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      });
    }

    // ── Compare hash ───────────────────────────────────────────────────────
    const submittedHash = hashOtp(String(otp).trim());
    if (submittedHash !== otpRecord.otpHash) {
      // Increment attempt counter
      otpRecord.attempts += 1;
      await otpRecord.save();

      const attemptsLeft = MAX_VERIFY_ATTEMPTS - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: attemptsLeft > 0
          ? `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
          : 'Too many incorrect attempts. Please request a new verification code.',
      });
    }

    // ── OTP correct ────────────────────────────────────────────────────────
    otpRecord.verified = true;
    otpRecord.attempts = 0;
    await otpRecord.save();

    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};
