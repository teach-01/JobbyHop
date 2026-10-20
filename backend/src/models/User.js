const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      // Not required when account was created via Google-only path (future)
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED', 'DELETED'],
      default: 'ACTIVE',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    resetPasswordUsed: {
      type: Boolean,
      default: false,
    },
    resetPasswordCreatedAt: Date,

    // ── Google OAuth fields ────────────────────────────────────────────────
    // Populated when user connects their Google account during registration
    // or logs in with Google.
    googleId: {
      type: String,
      sparse: true, // allows multiple null values (only unique when set)
      default: null,
    },
    googleLinked: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false, // set to true when email is verified via OTP or Google
    },
  },
  { timestamps: true }
);

// Safe partial unique indexes: active, suspended, blocked, and deactivated accounts
// retain uniqueness; soft-deleted accounts (isDeleted=true) release identifiers.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    name: 'email_partial_unique',
    partialFilterExpression: { isDeleted: false },
  }
);

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    name: 'phone_partial_unique',
    partialFilterExpression: { isDeleted: false, phone: { $gt: '' } },
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
