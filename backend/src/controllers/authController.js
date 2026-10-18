const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const WorkerProfile = require('../models/WorkerProfile');
const OtpStore = require('../models/OtpStore');
const { logAuditEvent } = require('../services/auditService');
const { generateToken } = require('../utils/jwt');
const { ROLES } = require('../config/constants');
const { validateWorkerProfilePhoto } = require('../utils/imageValidator');
const { saveBase64Image, duplicateSavedImage } = require('../utils/imageStorage');
const { sendPasswordResetEmail } = require('../services/emailService');

// Register Recruiter
exports.registerRecruiter = async (req, res, next) => {
  try {
    const { fullName, companyName, location, phone, email, password, companyDescription, companyLogo, businessExperience } = req.body;

    // ── Require email OTP verification before creating account ────────────
    const otpRecord = await OtpStore.findOne({ email: email.toLowerCase().trim() });
    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email verification required. Please verify your email with the OTP before registering.',
      });
    }

    let savedCompanyLogo = '';
    if (companyLogo && companyLogo.trim()) {
      const logoValidation = validateWorkerProfilePhoto(companyLogo);
      if (!logoValidation.valid) {
        return res.status(400).json({
          success: false,
          message: logoValidation.message,
        });
      }
      try {
        savedCompanyLogo = await saveBase64Image(companyLogo);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Failed to process company logo. Ensure it is a valid image.',
        });
      }
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPhone = (phone || '').trim();

    // Check duplicate email / phone across non-deleted accounts
    const existingUsers = await User.find({ 
      $or: [
        { email: normalizedEmail },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' },
    });
    if (existingUsers.length > 0) {
      const suspended = existingUsers.find(u => u.status === 'SUSPENDED');
      if (suspended) {
        return res.status(400).json({
          success: false,
          message: 'This account has been suspended. Please contact support.',
        });
      }
      const blocked = existingUsers.find(u => u.status === 'BLOCKED');
      if (blocked) {
        return res.status(400).json({
          success: false,
          message: 'This account has been blocked. Please contact support.',
        });
      }
      const deactivated = existingUsers.find(u => u.status === 'DEACTIVATED');
      if (deactivated) {
        return res.status(400).json({
          success: false,
          message: 'This account has been deactivated. Please contact support.',
        });
      }
      const dupEmail = existingUsers.find(u => u.email === normalizedEmail);
      if (dupEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Phone number is already registered',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: ROLES.RECRUITER,
      profileCompleted: true,
      status: 'ACTIVE',
      isDeleted: false,
    });

    const recruiterProfile = await RecruiterProfile.create({
      userId: user._id,
      fullName,
      companyName,
      location,
      phone,
      email: email.toLowerCase(),
      companyDescription: companyDescription || '',
      companyLogo: savedCompanyLogo || '',
      businessExperience: businessExperience || '',
    });

    // Clean up OTP record after successful registration
    await OtpStore.deleteOne({ email: email.toLowerCase().trim() });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Recruiter account registered successfully',
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: recruiterProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Register Worker
exports.registerWorker = async (req, res, next) => {
  try {
    const { fullName, profilePhoto, location, dob, phone, email, password, skills, experience, bio } = req.body;

    // Validate profile photo (presence, format: JPG/PNG/WEBP, magic bytes, max size: 1MB)
    const photoValidation = validateWorkerProfilePhoto(profilePhoto);
    if (!photoValidation.valid) {
      return res.status(400).json({
        success: false,
        message: photoValidation.message,
      });
    }

    let savedProfilePhoto = '';
    try {
      savedProfilePhoto = await saveBase64Image(profilePhoto);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process profile photo. Ensure it is a valid image.',
      });
    }

    // ── Require email OTP verification before creating account ────────────
    const otpRecord = await OtpStore.findOne({ email: email.toLowerCase().trim() });
    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email verification required. Please verify your email with the OTP before registering.',
      });
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPhone = (phone || '').trim();

    // Check duplicate email / phone across non-deleted accounts
    const existingUsers = await User.find({ 
      $or: [
        { email: normalizedEmail },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' },
    });
    if (existingUsers.length > 0) {
      const suspended = existingUsers.find(u => u.status === 'SUSPENDED');
      if (suspended) {
        return res.status(400).json({
          success: false,
          message: 'This account has been suspended. Please contact support.',
        });
      }
      const blocked = existingUsers.find(u => u.status === 'BLOCKED');
      if (blocked) {
        return res.status(400).json({
          success: false,
          message: 'This account has been blocked. Please contact support.',
        });
      }
      const deactivated = existingUsers.find(u => u.status === 'DEACTIVATED');
      if (deactivated) {
        return res.status(400).json({
          success: false,
          message: 'This account has been deactivated. Please contact support.',
        });
      }
      const dupEmail = existingUsers.find(u => u.email === normalizedEmail);
      if (dupEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Phone number is already registered',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: ROLES.WORKER,
      profileCompleted: true,
      status: 'ACTIVE',
      isDeleted: false,
    });

    const workerProfile = await WorkerProfile.create({
      userId: user._id,
      fullName,
      profilePhoto: savedProfilePhoto,
      location,
      dob: new Date(dob),
      phone,
      email: email.toLowerCase(),
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
      experience: Array.isArray(experience) ? experience : [],
      bio: bio || '',
    });

    // Clean up OTP record after successful registration
    await OtpStore.deleteOne({ email: email.toLowerCase().trim() });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Worker account registered successfully',
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: workerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Unified Login (Admin, Recruiter, Worker)
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Strictly query for active (non-deleted) account first
    const activeUser = await User.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' },
    });

    if (!activeUser) {
      // Check if an account with this email was deleted
      const deletedUser = await User.findOne({
        email: normalizedEmail,
        $or: [{ isDeleted: true }, { status: 'DELETED' }],
      });
      if (deletedUser) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deleted. Please contact support or register a new account.',
        });
      }

      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = activeUser;

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact support.' });
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
    }

    if (user.status === 'DEACTIVATED') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Role verification against target portal if specified
    const targetRole = (req.body.expectedRole || req.body.portal || '').toString().toUpperCase().trim();
    if (targetRole) {
      if (targetRole === ROLES.WORKER) {
        if (user.role !== ROLES.WORKER && user.role !== ROLES.ADMIN) {
          return res.status(401).json({ success: false, message: 'Invalid worker credentials.' });
        }
      } else if (targetRole === ROLES.RECRUITER) {
        if (user.role !== ROLES.RECRUITER && user.role !== ROLES.ADMIN) {
          return res.status(401).json({ success: false, message: 'Invalid recruiter credentials.' });
        }
      } else if (targetRole === ROLES.ADMIN) {
        if (user.role !== ROLES.ADMIN) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
      }
    }

    let profile = null;
    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId: user._id });
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId: user._id });
    }

    const token = generateToken(user);

    if (user.mustChangePassword) {
      return res.json({
        success: true,
        message: 'Password change required',
        requirePasswordChange: true,
        token,
        user: { id: user._id.toString(), _id: user._id.toString(), email: user.email, role: user.role }
      });
    }

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    let profile = null;

    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId: user._id });
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password request
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } });

    // Return a generic message to prevent email enumeration attacks
    if (!user || user.status === 'DEACTIVATED' || user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset code has been sent to it.',
      });
    }

    // Generate a cryptographically secure reset code: RESET-XXXXXX (6 uppercase hex chars)
    const rawToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    const resetToken = `RESET-${rawToken}`;

    // Store token on user with 15-minute expiry and fresh usage state
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.resetPasswordUsed = false;
    user.resetPasswordCreatedAt = new Date();
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Send reset email — do NOT swallow errors; return failure if email cannot be sent
    try {
      await sendPasswordResetEmail(normalizedEmail, resetToken, frontendUrl);
    } catch (emailErr) {
      console.error('[ForgotPassword] SMTP send error:', emailErr.message);
      // Clear the saved token so it doesn't linger on failure
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.resetPasswordUsed = false;
      user.resetPasswordCreatedAt = undefined;
      await user.save();
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.',
      });
    }

    console.log(`[ForgotPassword] Reset code sent to: ${normalizedEmail}`);
    res.json({
      success: true,
      message: 'Password reset code has been sent to your registered email address.',
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    // Accept token under multiple field names for compatibility
    const rawToken = (
      req.body.token ||
      req.body.resetToken ||
      req.body.resetCode ||
      ''
    ).toString().trim().toUpperCase();

    const { newPassword } = req.body;

    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'Reset code is required.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    // Find user by token – check expiry in the query
    const user = await User.findOne({
      resetPasswordToken: rawToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code. Please request a new one.' });
    }

    // Check single-use: token must not have been consumed already
    if (user.resetPasswordUsed === true) {
      return res.status(400).json({ success: false, message: 'This reset code has already been used. Please request a new one.' });
    }

    // Hash and save new password using the project's existing mechanism
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // Invalidate the token permanently
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordUsed = true;
    user.resetPasswordCreatedAt = undefined;

    // Also clear mustChangePassword flag if set
    user.mustChangePassword = false;

    await user.save();

    console.log(`[ResetPassword] Password reset successfully for: ${user.email}`);
    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// Logout
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};
// Force Change Password
exports.forceChangePassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (!user.mustChangePassword) {
      return res.status(400).json({ success: false, message: 'Password change is not required for this account' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.mustChangePassword = false;
    await user.save();

    let profile = null;
    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId: user._id });
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId: user._id });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Password updated successfully.',
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile,
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.deleteCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === ROLES.ADMIN || user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin account cannot be self-deleted.' });
    }

    let profileData = {};
    let subjectName = user.email;
    let profileImage = '';

    if (user.role === ROLES.WORKER) {
      const wp = await WorkerProfile.findOne({ userId }).lean();
      if (wp) {
        subjectName = wp.fullName;
        profileData = wp;
        // Duplicate the profile photo so the audit snapshot survives independently
        if (wp.profilePhoto) {
          profileImage = await duplicateSavedImage(wp.profilePhoto);
        }
      }
    } else if (user.role === ROLES.RECRUITER) {
      const rp = await RecruiterProfile.findOne({ userId }).lean();
      if (rp) {
        subjectName = rp.fullName || rp.companyName;
        profileData = rp;
        // Duplicate the company logo so the audit snapshot survives independently
        if (rp.companyLogo) {
          profileImage = await duplicateSavedImage(rp.companyLogo);
        }
      }
    }

    const deletionTimestamp = new Date();
    const auditSnapshot = {
      // Identity & Actor fields
      actorUserId: user._id,
      actorRole: user.role,
      action: "ACCOUNT_SELF_DELETED",
      targetUserId: user._id,
      targetRole: user.role,
      targetEmail: user.email,
      targetPhone: user.phone || profileData.phone || '',
      targetFullName: subjectName,
      targetLocation: profileData.location || null,

      // Explicit direct snapshot properties
      fullName: subjectName,
      email: user.email,
      phone: user.phone || profileData.phone || '',
      role: user.role,
      location: profileData.location || null,
      userId: user._id,
      profileImage: profileImage,
      accountStatus: user.status,
      isDeleted: true,
      deletionTimestamp: deletionTimestamp,
      actionType: "ACCOUNT_SELF_DELETED",

      // Extended profile information & timestamps
      profileInformation: profileData,
      timestamp: deletionTimestamp,
      deletionSource: "SELF_SERVICE",
    };

    const previousStatus = user.status;
    user.status = 'DELETED';
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.googleId = undefined;
    user.googleLinked = false;
    await user.save();

    await logAuditEvent({
      performedByUserId: user._id,
      performedByRole: user.role,
      action: 'ACCOUNT_SELF_DELETED',
      entityName: 'User',
      entityId: user._id,
      previousValue: auditSnapshot,
      newValue: { status: 'DELETED', isDeleted: true },
      notes: `[${user.role}] Account self-deleted by user. Historical snapshot captured.`,
      subjectName: subjectName,
      subjectRole: user.role,
    });

    res.json({
      success: true,
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

