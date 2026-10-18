const mongoose = require('mongoose');

/**
 * OtpStore – holds hashed OTPs for email verification.
 * One document per email. Overwritten on every new OTP send.
 * TTL index auto-removes expired documents from MongoDB.
 */
const otpStoreSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  },
  // SHA-256 hash of the OTP (never store plaintext)
  otpHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // MongoDB TTL – removes doc shortly after expiry
    index: { expires: 0 },
  },
  // Number of failed verification attempts
  attempts: {
    type: Number,
    default: 0,
  },
  // Timestamp of the last OTP send (for resend cooldown)
  lastSentAt: {
    type: Date,
    default: Date.now,
  },
  // Marked true once OTP is successfully verified
  verified: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('OtpStore', otpStoreSchema);
