/**
 * googleAuthController.js
 *
 * Handles Google OAuth for Worker and Recruiter registration & login.
 *
 * DESIGN RULES (non-negotiable):
 * 1. Google is used ONLY for identity verification (email confirmation).
 * 2. Google profile data (name, photo, phone, etc.) is NEVER used to populate
 *    Worker or Recruiter profiles. All profile data must be entered manually.
 * 3. Worker and Recruiter registrations remain on separate endpoints.
 * 4. The role is determined by the backend endpoint being called — never trusted
 *    from frontend input.
 * 5. Account status is respected: SUSPENDED / BLOCKED / DEACTIVATED / DELETED
 *    accounts are rejected.
 * 6. Duplicate account prevention: email is normalised (trimmed + lowercased)
 *    before every lookup. An existing account is never duplicated.
 * 7. Admin accounts can never be created via Google OAuth.
 */

const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const WorkerProfile = require('../models/WorkerProfile');
const OtpStore = require('../models/OtpStore');
const { generateToken } = require('../utils/jwt');
const { ROLES } = require('../config/constants');
const { validateWorkerProfilePhoto } = require('../utils/imageValidator');
const { saveBase64Image } = require('../utils/imageStorage');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// ── Helper: verify Google ID token and return payload ──────────────────────
async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';

  // In non-production, support mock Google token for local development & automated test suites
  if (process.env.NODE_ENV !== 'production' && typeof idToken === 'string' && idToken.startsWith('mock_google_token:')) {
    const email = idToken.replace('mock_google_token:', '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Invalid mock Google token: invalid email.');
    }
    return {
      email,
      sub: `mock_google_sub_${Buffer.from(email).toString('hex')}`,
    };
  }

  if (!clientId) {
    throw new Error('Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID in the backend environment.');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token: no email in payload.');
  }
  return payload;
}

// ── Helper: resolve Google Identity from idToken or registrationToken ─────
async function resolveGoogleIdentity(body) {
  const { registrationToken, idToken } = body;

  if (registrationToken) {
    let decoded;
    try {
      decoded = jwt.verify(
        registrationToken,
        process.env.JWT_SECRET || 'jobbyhop_super_secret_jwt_key_2026_production_ready'
      );
    } catch (err) {
      throw new Error('Google registration session has expired. Please sign in with Google again.');
    }

    if (decoded?.type !== 'GOOGLE_REGISTRATION_HANDOFF' || !decoded?.email) {
      throw new Error('Invalid Google registration token.');
    }

    return {
      googleEmail: decoded.email.toLowerCase().trim(),
      googleId: decoded.googleId,
      expectedRole: decoded.role,
    };
  }

  if (idToken) {
    const googlePayload = await verifyGoogleToken(idToken);
    return {
      googleEmail: googlePayload.email.toLowerCase().trim(),
      googleId: googlePayload.sub,
    };
  }

  throw new Error('Google idToken or registrationToken is required.');
}

// ── Helper: check account status ────────────────────────────────────────────
function checkAccountStatus(user) {
  if (user.isDeleted || user.status === 'DELETED') {
    return 'This account has been deleted. Please contact support or register a new account.';
  }
  if (user.status === 'SUSPENDED') {
    return 'Your account has been suspended. Please contact support.';
  }
  if (user.status === 'BLOCKED') {
    return 'Your account has been blocked. Please contact support.';
  }
  if (user.status === 'DEACTIVATED') {
    return 'Your account has been deactivated. Please contact support.';
  }
  return null; // OK
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/google/register/worker
//
// Called during Worker registration when the user clicks "Connect with Google".
// The frontend sends:
//   - idToken   : Google credential (ID token) from Google Sign-In
//   - formData  : ALL manually-entered Worker profile fields
//     (fullName, profilePhoto, location, dob, phone, email, password,
//      confirmPassword, skills, bio)
//
// Google is ONLY used to verify the email and skip OTP.
// Profile data from Google is NEVER used.
// ═══════════════════════════════════════════════════════════════════════════
exports.googleRegisterWorker = async (req, res, next) => {
  try {
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'formData is required.' });
    }

    // ── 1. Verify Google token or registrationToken ──────────────────────
    let googleIdentity;
    try {
      googleIdentity = await resolveGoogleIdentity(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Google verification failed: ${err.message}` });
    }

    const { googleEmail, googleId, expectedRole } = googleIdentity;

    if (expectedRole && expectedRole !== ROLES.WORKER) {
      return res.status(400).json({
        success: false,
        message: 'This Google registration was initiated for Recruiter. Please complete registration on the Recruiter Registration page.',
        correctPortal: '/register/recruiter',
      });
    }

    // ── 2. Confirm Google email matches the form email ────────────────────
    const formEmail = (formData.email || '').toLowerCase().trim();
    if (googleEmail !== formEmail) {
      return res.status(400).json({
        success: false,
        message: 'The Google account email does not match the registration email. Please use the same email for both.',
      });
    }

    // ── 3. Validate required Worker fields ────────────────────────────────
    const { fullName, profilePhoto, location, dob, phone, password, skills, bio } = formData;
    if (!fullName || !profilePhoto || !location || !dob || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All required Worker fields must be filled in manually.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // ── 4. Validate profile photo ─────────────────────────────────────────
    const photoValidation = validateWorkerProfilePhoto(profilePhoto);
    if (!photoValidation.valid) {
      return res.status(400).json({ success: false, message: photoValidation.message });
    }
    let savedProfilePhoto = '';
    try {
      savedProfilePhoto = await saveBase64Image(profilePhoto);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Failed to process profile photo.' });
    }

    // ── 5. Duplicate and lifecycle check across non-deleted accounts ───────
    const existingUsers = await User.find({
      $or: [
        { email: formEmail },
        ...(phone ? [{ phone }] : []),
        ...(googleId ? [{ googleId }] : [])
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' },
    });

    if (existingUsers.length > 0) {
      const suspended = existingUsers.find(u => u.status === 'SUSPENDED');
      if (suspended) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact support.',
        });
      }
      const blocked = existingUsers.find(u => u.status === 'BLOCKED');
      if (blocked) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been blocked. Please contact support.',
        });
      }
      const deactivated = existingUsers.find(u => u.status === 'DEACTIVATED');
      if (deactivated) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }
      const dupEmail = existingUsers.find(u => u.email === formEmail);
      if (dupEmail) {
        if (dupEmail.role === ROLES.RECRUITER) {
          return res.status(400).json({
            success: false,
            message: 'This email is already registered as an Event Recruiter. Please log in via the Recruiter Login page.',
            correctPortal: '/login/recruiter',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'An account with this email is already registered. Please sign in instead.',
        });
      }
      const dupPhone = existingUsers.find(u => phone && u.phone === phone);
      if (dupPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is already registered.',
        });
      }
      const dupGoogle = existingUsers.find(u => googleId && u.googleId === googleId);
      if (dupGoogle) {
        if (dupGoogle.role === ROLES.RECRUITER) {
          return res.status(400).json({
            success: false,
            message: 'This Google account is already registered as an Event Recruiter. Please log in via the Recruiter Login page.',
            correctPortal: '/login/recruiter',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'This Google account is already linked to an existing account. Please sign in instead.',
        });
      }
    }

    // ── 6. Create new Worker account ──────────────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: formEmail,
      phone,
      passwordHash,
      role: ROLES.WORKER,
      profileCompleted: true,
      status: 'ACTIVE',
      isDeleted: false,
      googleId,
      googleLinked: true,
      emailVerified: true,
    });

    const workerProfile = await WorkerProfile.create({
      userId: user._id,
      fullName,
      profilePhoto: savedProfilePhoto,
      location,
      dob: new Date(dob),
      phone,
      email: formEmail,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s) => s.trim()) : []),
      experience: [],
      bio: bio || '',
    });

    // Clean up any OTP record for this email (Google verified it, so it's no longer needed)
    await OtpStore.deleteOne({ email: formEmail });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Worker account created and Google account connected successfully.',
      googleLinked: true,
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

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/google/register/recruiter
//
// Called during Recruiter registration when the user clicks "Connect with Google".
// The frontend sends:
//   - idToken   : Google credential (ID token) from Google Sign-In
//   - formData  : ALL manually-entered Recruiter profile fields
//     (fullName, companyName, location, phone, email, password,
//      confirmPassword, companyDescription)
//
// Google is ONLY used to verify the email and skip OTP.
// Profile data from Google is NEVER used.
// ═══════════════════════════════════════════════════════════════════════════
exports.googleRegisterRecruiter = async (req, res, next) => {
  try {
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ success: false, message: 'formData is required.' });
    }

    // ── 1. Verify Google token or registrationToken ──────────────────────
    let googleIdentity;
    try {
      googleIdentity = await resolveGoogleIdentity(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Google verification failed: ${err.message}` });
    }

    const { googleEmail, googleId, expectedRole } = googleIdentity;

    if (expectedRole && expectedRole !== ROLES.RECRUITER) {
      return res.status(400).json({
        success: false,
        message: 'This Google registration was initiated for Worker. Please complete registration on the Worker Registration page.',
        correctPortal: '/register/worker',
      });
    }

    // ── 2. Confirm Google email matches the form email ────────────────────
    const formEmail = (formData.email || '').toLowerCase().trim();
    if (googleEmail !== formEmail) {
      return res.status(400).json({
        success: false,
        message: 'The Google account email does not match the registration email. Please use the same email for both.',
      });
    }

    // ── 3. Validate required Recruiter fields ──────────────────────────────
    const { fullName, companyName, location, phone, password, companyDescription } = formData;
    if (!fullName || !companyName || !location || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All required Recruiter fields must be filled in manually.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // ── 4. Duplicate and lifecycle check across non-deleted accounts ───────
    const existingUsers = await User.find({
      $or: [
        { email: formEmail },
        ...(phone ? [{ phone }] : []),
        ...(googleId ? [{ googleId }] : [])
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' },
    });

    if (existingUsers.length > 0) {
      const suspended = existingUsers.find(u => u.status === 'SUSPENDED');
      if (suspended) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact support.',
        });
      }
      const blocked = existingUsers.find(u => u.status === 'BLOCKED');
      if (blocked) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been blocked. Please contact support.',
        });
      }
      const deactivated = existingUsers.find(u => u.status === 'DEACTIVATED');
      if (deactivated) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }
      const dupEmail = existingUsers.find(u => u.email === formEmail);
      if (dupEmail) {
        if (dupEmail.role === ROLES.WORKER) {
          return res.status(400).json({
            success: false,
            message: 'This email is already registered as an Event Worker. Please log in via the Worker Login page.',
            correctPortal: '/login/worker',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'An account with this email is already registered. Please sign in instead.',
        });
      }
      const dupPhone = existingUsers.find(u => phone && u.phone === phone);
      if (dupPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is already registered.',
        });
      }
      const dupGoogle = existingUsers.find(u => googleId && u.googleId === googleId);
      if (dupGoogle) {
        if (dupGoogle.role === ROLES.WORKER) {
          return res.status(400).json({
            success: false,
            message: 'This Google account is already registered as an Event Worker. Please log in via the Worker Login page.',
            correctPortal: '/login/worker',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'This Google account is already linked to an existing account. Please sign in instead.',
        });
      }
    }

    // ── 5. Create new Recruiter account ───────────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: formEmail,
      phone,
      passwordHash,
      role: ROLES.RECRUITER,
      profileCompleted: true,
      status: 'ACTIVE',
      isDeleted: false,
      googleId,
      googleLinked: true,
      emailVerified: true,
    });

    const recruiterProfile = await RecruiterProfile.create({
      userId: user._id,
      fullName,
      companyName,
      location,
      phone,
      email: formEmail,
      companyDescription: companyDescription || '',
      companyLogo: '',
      businessExperience: '',
    });

    // Clean up any OTP record for this email
    await OtpStore.deleteOne({ email: formEmail });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Recruiter account created and Google account connected successfully.',
      googleLinked: true,
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

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/google/login
//
// Called from the Login page when the user clicks "Continue with Google".
// The frontend sends:
//   - idToken      : Google credential (ID token)
//   - expectedRole : optional — 'WORKER' | 'RECRUITER' (used to enforce
//                    role-specific login pages)
//
// Behaviour:
//   1. Verify the Google ID token.
//   2. Find the existing account linked to this Google email/googleId.
//   3. Enforce account status.
//   4. Return a JWT — no profile data is requested again.
//   5. Admin accounts are never returned via this endpoint.
// ═══════════════════════════════════════════════════════════════════════════
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken, expectedRole } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken is required.' });
    }

    // ── 1. Verify Google token ────────────────────────────────────────────
    let googlePayload;
    try {
      googlePayload = await verifyGoogleToken(idToken);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Google verification failed: ${err.message}` });
    }

    const googleEmail = googlePayload.email.toLowerCase().trim();
    const googleId = googlePayload.sub;

    // ── 2. Find active account by googleId first, then by email ──────────
    let user = await User.findOne({ googleId, isDeleted: { $ne: true }, status: { $ne: 'DELETED' } });
    if (!user) {
      user = await User.findOne({ email: googleEmail, isDeleted: { $ne: true }, status: { $ne: 'DELETED' } });
    }

    if (!user) {
      // Check if there is an account that is suspended, blocked, or deactivated
      const restrictedUser = await User.findOne({
        $or: [{ googleId }, { email: googleEmail }],
        status: { $in: ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'] },
        isDeleted: { $ne: true },
      });
      if (restrictedUser) {
        const statusError = checkAccountStatus(restrictedUser);
        if (statusError) return res.status(403).json({ success: false, message: statusError });
      }

      // New Google user or re-registering after deletion — generate short-lived signed registration handoff token (15 mins)
      const targetExpectedRole = expectedRole ? expectedRole.toString().toUpperCase().trim() : undefined;
      const registrationToken = jwt.sign(
        {
          type: 'GOOGLE_REGISTRATION_HANDOFF',
          email: googleEmail,
          googleId,
          role: targetExpectedRole,
        },
        process.env.JWT_SECRET || 'jobbyhop_super_secret_jwt_key_2026_production_ready',
        { expiresIn: '15m' }
      );

      return res.status(200).json({
        success: true,
        isNewUser: true,
        googleEmail,
        registrationToken,
        expectedRole: targetExpectedRole,
        message: 'Google identity verified. Please complete registration.',
      });
    }

    // ── 3. Prevent Admin login via Google ─────────────────────────────────
    if (user.role === ROLES.ADMIN || user.role === 'OPERATIONS') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot use Google login.',
      });
    }

    // ── 4. Enforce account status ─────────────────────────────────────────
    const statusError = checkAccountStatus(user);
    if (statusError) return res.status(403).json({ success: false, message: statusError });

    // ── 5. Role enforcement (portal-specific login) ───────────────────────
    if (expectedRole) {
      const targetRole = expectedRole.toString().toUpperCase().trim();
      if (targetRole === ROLES.WORKER && user.role !== ROLES.WORKER) {
        if (user.role === ROLES.RECRUITER) {
          return res.status(401).json({
            success: false,
            message: 'Invalid worker credentials. This Google account is registered as an Event Recruiter. Please log in via the Recruiter Login page.',
            correctPortal: '/login/recruiter',
          });
        }
        return res.status(401).json({ success: false, message: 'Invalid worker credentials.' });
      }
      if (targetRole === ROLES.RECRUITER && user.role !== ROLES.RECRUITER) {
        if (user.role === ROLES.WORKER) {
          return res.status(401).json({
            success: false,
            message: 'Invalid recruiter credentials. This Google account is registered as an Event Worker. Please log in via the Worker Login page.',
            correctPortal: '/login/worker',
          });
        }
        return res.status(401).json({ success: false, message: 'Invalid recruiter credentials.' });
      }
    }

    // ── 6. Ensure googleId is stored (link if it was missing) ─────────────
    if (!user.googleId || user.googleId !== googleId) {
      user.googleId = googleId;
      user.googleLinked = true;
      user.emailVerified = true;
      await user.save();
    }

    // ── 7. Fetch profile ──────────────────────────────────────────────────
    let profile = null;
    if (user.role === ROLES.RECRUITER) {
      profile = await RecruiterProfile.findOne({ userId: user._id });
    } else if (user.role === ROLES.WORKER) {
      profile = await WorkerProfile.findOne({ userId: user._id });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Logged in successfully via Google.',
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

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/auth/google/verify-only
//
// Lightweight endpoint: verify a Google ID token and return the email.
// Used by the registration forms to confirm the Google email before
// the user clicks the final "Register" button.
// ═══════════════════════════════════════════════════════════════════════════
exports.googleVerifyOnly = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken is required.' });
    }

    let googlePayload;
    try {
      googlePayload = await verifyGoogleToken(idToken);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Google verification failed: ${err.message}` });
    }

    return res.json({
      success: true,
      googleEmail: googlePayload.email.toLowerCase().trim(),
      googleId: googlePayload.sub,
    });
  } catch (error) {
    next(error);
  }
};
