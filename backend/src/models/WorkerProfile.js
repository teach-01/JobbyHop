const mongoose = require('mongoose');

const workerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    profilePhoto: {
      type: String,
      required: [true, 'Profile photo is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    experience: [
      {
        title: String,
        eventType: String,
        duration: String,
        description: String,
      },
    ],
    availability: {
      isAvailable: {
        type: Boolean,
        default: true,
      },
      availableDates: [Date],
      unavailableDates: [Date],
      availableTimeSlots: [String], // e.g. ['Morning', 'Afternoon', 'Evening', 'Night']
      preferredEventTypes: [String],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    totalAssignments: {
      type: Number,
      default: 0,
    },
    completedEventsCount: {
      type: Number,
      default: 0,
    },
    bio: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// ── IMMUTABILITY RESTRICTIONS (DATABASE LEVEL) ─────────────────────────────
// Track original verified values when document is loaded from database
workerProfileSchema.post('init', function () {
  this._original = {
    fullName: this.fullName || null,
    dob: this.dob ? new Date(this.dob).toISOString().split('T')[0] : null,
    phone: this.phone || null,
  };
});

// Enforce immutability on document save
workerProfileSchema.pre('save', function (next) {
  if (!this.isNew && this._original) {
    if (this._original.fullName && this.isModified('fullName') && this.fullName?.trim() !== this._original.fullName?.trim()) {
      return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
    }
    if (this._original.dob && this.isModified('dob')) {
      const newDobStr = this.dob ? new Date(this.dob).toISOString().split('T')[0] : '';
      if (newDobStr !== this._original.dob) {
        return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
      }
    }
    if (this._original.phone && this.isModified('phone') && this.phone?.trim() !== this._original.phone?.trim()) {
      return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
    }
  }
  next();
});

// Enforce immutability on direct query updates
workerProfileSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  const setFields = update.$set || update;
  const hasImmutableFieldUpdate =
    setFields.fullName !== undefined ||
    setFields.dob !== undefined ||
    setFields.phone !== undefined;

  if (hasImmutableFieldUpdate) {
    const doc = await this.model.findOne(this.getQuery()).lean();
    if (doc) {
      if (doc.fullName && setFields.fullName !== undefined && setFields.fullName?.trim() !== doc.fullName?.trim()) {
        return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
      }
      if (doc.dob && setFields.dob !== undefined) {
        const docDob = new Date(doc.dob).toISOString().split('T')[0];
        const newDob = setFields.dob ? new Date(setFields.dob).toISOString().split('T')[0] : '';
        if (newDob !== docDob) {
          return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
        }
      }
      if (doc.phone && setFields.phone !== undefined && setFields.phone?.trim() !== doc.phone?.trim()) {
        return next(new Error('Legal name, date of birth, and phone number cannot be changed after verification.'));
      }
    }
  }
  next();
});

module.exports = mongoose.models.WorkerProfile || mongoose.model('WorkerProfile', workerProfileSchema);

