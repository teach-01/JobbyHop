const request = require('supertest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const OtpStore = require('../models/OtpStore');
const AuditLog = require('../models/AuditLog');
const { connectDB, closeDB } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { ROLES } = require('../config/constants');
const emailService = require('../services/emailService');

const VALID_PHOTO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('JobbyHop — Account Lifecycle & Re-Registration After Deletion', () => {
  let adminToken;
  let adminUser;

  beforeAll(async () => {
    await connectDB();

    // Mock sendOtpEmail so tests don't depend on external SMTP
    vi.spyOn(emailService, 'sendOtpEmail').mockResolvedValue(true);

    // Create Admin account
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    adminUser = await User.create({
      email: 'admin_lifecycle@jobbyhop.com',
      phone: '+919999900000',
      passwordHash,
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      isDeleted: false,
    });
    adminToken = generateToken(adminUser);
  });

  afterAll(async () => {
    await closeDB();
  });

  // Helper to ensure OTP verification is set for an email
  async function preVerifyEmail(email) {
    const normalized = email.toLowerCase().trim();
    await OtpStore.findOneAndUpdate(
      { email: normalized },
      {
        otpHash: crypto.createHash('sha256').update('123456').digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        verified: true,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  // ── TEST 1: Admin deletes Worker → same email/mobile can register again ──
  it('1. Admin deletes Worker -> same email/mobile can register again with a fresh account and new ID', async () => {
    const email = 'worker_adm_del@jobbyhop.com';
    const phone = '9876540001';

    // 1a. Register original Worker
    await preVerifyEmail(email);
    const regRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Worker Original',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Jaipur, RJ',
        dob: '1998-05-15',
        phone,
        email,
        password: 'Password@123',
        skills: ['Registration Desk'],
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    const oldWorkerId = regRes.body.user.id;
    const oldWorkerToken = regRes.body.token;

    // 1b. Admin deletes the Worker account
    const delRes = await request(app)
      .delete(`/api/admin/users/${oldWorkerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Administrative cleanup test' });

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.user.status).toBe('DELETED');
    expect(delRes.body.user.isDeleted).toBe(true);

    // Verify DB state of deleted worker
    const deletedDbUser = await User.findById(oldWorkerId);
    expect(deletedDbUser.status).toBe('DELETED');
    expect(deletedDbUser.isDeleted).toBe(true);

    // 1c. Verify old token cannot access endpoints
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldWorkerToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.message).toContain('deleted');

    // 1d. Audit history is preserved
    const auditLog = await AuditLog.findOne({
      entityId: oldWorkerId,
      action: 'USER_DELETED',
    });
    expect(auditLog).toBeDefined();
    expect(auditLog.previousValue.email).toBe(email);

    // 1e. Re-register Worker with SAME email and mobile number
    await preVerifyEmail(email);
    const reRegRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Worker Fresh Re-Registered',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Jaipur, RJ',
        dob: '1998-05-15',
        phone,
        email,
        password: 'NewPassword@123',
        skills: ['Stage Hand'],
      });

    expect(reRegRes.status).toBe(201);
    expect(reRegRes.body.success).toBe(true);
    const newWorkerId = reRegRes.body.user.id;
    expect(newWorkerId).not.toBe(oldWorkerId);

    // 1f. Verify login works with new credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword@123', expectedRole: 'WORKER' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.user.id).toBe(newWorkerId);

    // 1g. Verify old credentials fail
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password@123', expectedRole: 'WORKER' });
    expect(oldLoginRes.status).toBe(401);
  });

  // ── TEST 2: Admin deletes Recruiter → same email/mobile can register again ──
  it('2. Admin deletes Recruiter -> same email/mobile can register again with a fresh account and new ID', async () => {
    const email = 'recruiter_adm_del@jobbyhop.com';
    const phone = '9876540002';

    // 2a. Register original Recruiter
    await preVerifyEmail(email);
    const regRes = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Recruiter Original',
        companyName: 'Events Inc',
        location: 'Mumbai, MH',
        phone,
        email,
        password: 'Password@123',
        companyDescription: 'Top Event Staffing',
      });

    expect(regRes.status).toBe(201);
    const oldRecruiterId = regRes.body.user.id;
    const oldRecruiterToken = regRes.body.token;

    // 2b. Admin deletes Recruiter
    const delRes = await request(app)
      .delete(`/api/admin/users/${oldRecruiterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Admin requested deletion' });

    expect(delRes.status).toBe(200);
    expect(delRes.body.user.status).toBe('DELETED');
    expect(delRes.body.user.isDeleted).toBe(true);

    // 2c. Old token rejected
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldRecruiterToken}`);
    expect(meRes.status).toBe(401);

    // 2d. Re-register Recruiter with SAME email and mobile number
    await preVerifyEmail(email);
    const reRegRes = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Recruiter Fresh Re-Registered',
        companyName: 'Events Inc Fresh',
        location: 'Mumbai, MH',
        phone,
        email,
        password: 'NewPassword@123',
        companyDescription: 'Re-registered agency',
      });

    expect(reRegRes.status).toBe(201);
    const newRecruiterId = reRegRes.body.user.id;
    expect(newRecruiterId).not.toBe(oldRecruiterId);

    // 2e. Login to fresh account
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword@123', expectedRole: 'RECRUITER' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.id).toBe(newRecruiterId);
  });

  // ── TEST 3: Worker self-deletes → same email/mobile can register again ──
  it('3. Worker self-deletes -> same email/mobile can register again with fresh account', async () => {
    const email = 'worker_self_del@jobbyhop.com';
    const phone = '9876540003';

    // 3a. Register Worker
    await preVerifyEmail(email);
    const regRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Worker Self Del',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi, DL',
        dob: '2000-01-01',
        phone,
        email,
        password: 'Password@123',
      });

    expect(regRes.status).toBe(201);
    const oldWorkerId = regRes.body.user.id;
    const workerToken = regRes.body.token;

    // 3b. Worker self-deletes account through account settings
    const selfDelRes = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(selfDelRes.status).toBe(200);
    expect(selfDelRes.body.success).toBe(true);

    // Verify DB state
    const userDoc = await User.findById(oldWorkerId);
    expect(userDoc.status).toBe('DELETED');
    expect(userDoc.isDeleted).toBe(true);

    // Verify audit log ACCOUNT_SELF_DELETED
    const audit = await AuditLog.findOne({
      entityId: oldWorkerId,
      action: 'ACCOUNT_SELF_DELETED',
    });
    expect(audit).toBeDefined();
    expect(audit.previousValue.email).toBe(email);

    // 3c. Old token is immediately dead
    const oldTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(oldTokenRes.status).toBe(401);

    // 3d. Re-register Worker with same email and phone
    await preVerifyEmail(email);
    const reRegRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Worker Self Del New Account',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi, DL',
        dob: '2000-01-01',
        phone,
        email,
        password: 'NewPassword@123',
      });

    expect(reRegRes.status).toBe(201);
    const newWorkerId = reRegRes.body.user.id;
    expect(newWorkerId).not.toBe(oldWorkerId);

    // 3e. Login to new account works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword@123', expectedRole: 'WORKER' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.id).toBe(newWorkerId);
  });

  // ── TEST 4: Recruiter self-deletes → same email/mobile can register again ──
  it('4. Recruiter self-deletes -> same email/mobile can register again with fresh account', async () => {
    const email = 'recruiter_self_del@jobbyhop.com';
    const phone = '9876540004';

    // 4a. Register Recruiter
    await preVerifyEmail(email);
    const regRes = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Recruiter Self Del',
        companyName: 'Self Del Co',
        location: 'Bangalore, KA',
        phone,
        email,
        password: 'Password@123',
      });

    expect(regRes.status).toBe(201);
    const oldRecruiterId = regRes.body.user.id;
    const recruiterToken = regRes.body.token;

    // 4b. Self-delete
    const selfDelRes = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(selfDelRes.status).toBe(200);

    const userDoc = await User.findById(oldRecruiterId);
    expect(userDoc.status).toBe('DELETED');
    expect(userDoc.isDeleted).toBe(true);

    // 4c. Old token dead
    const checkRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(checkRes.status).toBe(401);

    // 4d. Re-register Recruiter with same credentials
    await preVerifyEmail(email);
    const reRegRes = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Recruiter Self Del Re-Registered',
        companyName: 'Self Del Co 2.0',
        location: 'Bangalore, KA',
        phone,
        email,
        password: 'NewPassword@123',
      });

    expect(reRegRes.status).toBe(201);
    const newRecruiterId = reRegRes.body.user.id;
    expect(newRecruiterId).not.toBe(oldRecruiterId);

    // 4e. Login with new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword@123', expectedRole: 'RECRUITER' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.id).toBe(newRecruiterId);
  });

  // ── TEST 5: Suspended or blocked account → re-registration is rejected ──
  it('5. Suspended or blocked account -> re-registration is rejected', async () => {
    // 5a. Suspended user
    const suspendedEmail = 'suspended_check@jobbyhop.com';
    const suspendedPhone = '9876540005';
    await User.create({
      email: suspendedEmail,
      phone: suspendedPhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.WORKER,
      status: 'SUSPENDED',
      isDeleted: false,
    });

    // Re-registration with same email should fail
    await preVerifyEmail(suspendedEmail);
    const suspRegRes1 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Suspended Worker Try',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: '9876549999',
        email: suspendedEmail,
        password: 'Password@123',
      });
    expect(suspRegRes1.status).toBe(400);
    expect(suspRegRes1.body.message).toContain('suspended');

    // Re-registration with same phone should fail
    const diffEmail = 'diff_email@jobbyhop.com';
    await preVerifyEmail(diffEmail);
    const suspRegRes2 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Suspended Worker Try 2',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: suspendedPhone,
        email: diffEmail,
        password: 'Password@123',
      });
    expect(suspRegRes2.status).toBe(400);
    expect(suspRegRes2.body.message).toContain('suspended');

    // 5b. Blocked user
    const blockedEmail = 'blocked_check@jobbyhop.com';
    const blockedPhone = '9876540006';
    await User.create({
      email: blockedEmail,
      phone: blockedPhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.RECRUITER,
      status: 'BLOCKED',
      isDeleted: false,
    });

    await preVerifyEmail(blockedEmail);
    const blockedRegRes1 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Blocked Recruiter Try',
        companyName: 'Blocked Co',
        location: 'Delhi',
        phone: '9876548888',
        email: blockedEmail,
        password: 'Password@123',
      });
    expect(blockedRegRes1.status).toBe(400);
    expect(blockedRegRes1.body.message).toContain('blocked');

    const diffEmail2 = 'diff_email2@jobbyhop.com';
    await preVerifyEmail(diffEmail2);
    const blockedRegRes2 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Blocked Recruiter Try 2',
        companyName: 'Blocked Co',
        location: 'Delhi',
        phone: blockedPhone,
        email: diffEmail2,
        password: 'Password@123',
      });
    expect(blockedRegRes2.status).toBe(400);
    expect(blockedRegRes2.body.message).toContain('blocked');
  });

  // ── TEST 6: Active account → duplicate registration is rejected ──
  it('6. Active account -> duplicate registration is rejected', async () => {
    const activeEmail = 'active_check@jobbyhop.com';
    const activePhone = '9876540007';

    await User.create({
      email: activeEmail,
      phone: activePhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.WORKER,
      status: 'ACTIVE',
      isDeleted: false,
    });

    // Try registering with same email
    await preVerifyEmail(activeEmail);
    const dupEmailRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Duplicate Email Worker',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: '9876547777',
        email: activeEmail,
        password: 'Password@123',
      });
    expect(dupEmailRes.status).toBe(400);
    expect(dupEmailRes.body.message).toBe('Email is already registered');

    // Try registering with same phone
    const newEmail = 'new_unique_email@jobbyhop.com';
    await preVerifyEmail(newEmail);
    const dupPhoneRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Duplicate Phone Worker',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: activePhone,
        email: newEmail,
        password: 'Password@123',
      });
    expect(dupPhoneRes.status).toBe(400);
    expect(dupPhoneRes.body.message).toBe('Phone number is already registered');
  });

  // ── TEST 7: Newly registered accounts can verify their email and log in ──
  it('7. Newly registered accounts can verify their email and log in successfully', async () => {
    const testEmail = 'verify_and_login@jobbyhop.com';
    const testPhone = '9876540008';
    const testPassword = 'SecurePassword@123';

    // 7a. Send OTP
    const sendOtpRes = await request(app)
      .post('/api/auth/send-email-otp')
      .send({ email: testEmail });
    expect(sendOtpRes.status).toBe(200);
    expect(sendOtpRes.body.success).toBe(true);

    // 7b. Retrieve stored OTP and verify
    const storedOtp = await OtpStore.findOne({ email: testEmail });
    expect(storedOtp).toBeDefined();
    expect(storedOtp.verified).toBe(false);

    // Mark as verified via endpoint (simulate user entering the OTP code sent to them)
    // For test stability, we update otpHash to a known SHA-256 and submit
    const knownCode = '654321';
    storedOtp.otpHash = crypto.createHash('sha256').update(knownCode).digest('hex');
    await storedOtp.save();

    const verifyOtpRes = await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ email: testEmail, otp: knownCode });
    expect(verifyOtpRes.status).toBe(200);
    expect(verifyOtpRes.body.success).toBe(true);

    // 7c. Complete Registration
    const regRes = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Verified Worker',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Jaipur, RJ',
        dob: '2001-08-20',
        phone: testPhone,
        email: testEmail,
        password: testPassword,
        skills: ['Crowd Control'],
      });
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);

    // 7d. Log in with registered credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
        expectedRole: 'WORKER',
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();

    // 7e. Use issued token to fetch profile
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testEmail);
    expect(meRes.body.user.role).toBe(ROLES.WORKER);
    expect(meRes.body.user.profile.fullName).toBe('Verified Worker');
  });
});
