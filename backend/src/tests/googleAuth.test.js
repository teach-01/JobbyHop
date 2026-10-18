const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const { connectDB, closeDB } = require('../config/db');
const { ROLES } = require('../config/constants');

const VALID_PHOTO_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Google Role-Specific Authentication & Registration Suite', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  const ts = Date.now();
  const workerEmail = `google_worker_${ts}@example.com`;
  const recruiterEmail = `google_recruiter_${ts}@example.com`;
  let workerRegistrationToken = '';
  let recruiterRegistrationToken = '';

  // 1. Worker Login + new Google email -> returns registrationToken with expectedRole: WORKER
  it('1. Worker Login + new Google email -> returns isNewUser: true with WORKER registrationToken', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${workerEmail}`,
        expectedRole: 'WORKER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.googleEmail).toBe(workerEmail);
    expect(res.body.expectedRole).toBe('WORKER');
    expect(res.body.registrationToken).toBeDefined();

    workerRegistrationToken = res.body.registrationToken;
  });

  // 2. Worker Registration with registrationToken -> creates Worker account
  it('2. Worker completes registration with registrationToken (skips OTP)', async () => {
    const res = await request(app)
      .post('/api/auth/google/register/worker')
      .send({
        registrationToken: workerRegistrationToken,
        formData: {
          fullName: 'Aarav Sharma',
          profilePhoto: VALID_PHOTO_BASE64,
          location: 'Bengaluru, KA',
          dob: '1998-07-12',
          phone: `+919811${String(ts).slice(-6)}`,
          email: workerEmail,
          password: 'Password@123',
          skills: 'Security, Stage Setup',
          bio: '5 years event experience',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.WORKER);
    expect(res.body.user.email).toBe(workerEmail);
    expect(res.body.googleLinked).toBe(true);
  });

  // 3. Worker Login + existing Worker Google account -> logs in directly to Worker Dashboard
  it('3. Worker Login + existing Worker Google account -> authenticates directly without registration prompt', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${workerEmail}`,
        expectedRole: 'WORKER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.WORKER);
    expect(res.body.isNewUser).toBeUndefined();
  });

  // 4. Recruiter Login + new Google email -> returns registrationToken with expectedRole: RECRUITER
  it('4. Recruiter Login + new Google email -> returns isNewUser: true with RECRUITER registrationToken', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${recruiterEmail}`,
        expectedRole: 'RECRUITER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.googleEmail).toBe(recruiterEmail);
    expect(res.body.expectedRole).toBe('RECRUITER');
    expect(res.body.registrationToken).toBeDefined();

    recruiterRegistrationToken = res.body.registrationToken;
  });

  // 5. Recruiter Registration with registrationToken -> creates Recruiter account
  it('5. Recruiter completes registration with registrationToken (skips OTP)', async () => {
    const res = await request(app)
      .post('/api/auth/google/register/recruiter')
      .send({
        registrationToken: recruiterRegistrationToken,
        formData: {
          fullName: 'Priya Mehta',
          companyName: 'Grand Events Co.',
          location: 'Delhi, DL',
          phone: `+919812${String(ts).slice(-6)}`,
          email: recruiterEmail,
          password: 'Password@123',
          companyDescription: 'Luxury wedding and corporate summit planners',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.RECRUITER);
    expect(res.body.user.email).toBe(recruiterEmail);
    expect(res.body.googleLinked).toBe(true);
  });

  // 6. Recruiter Login + existing Recruiter Google account -> logs in directly to Recruiter Dashboard
  it('6. Recruiter Login + existing Recruiter Google account -> authenticates directly without registration prompt', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${recruiterEmail}`,
        expectedRole: 'RECRUITER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe(ROLES.RECRUITER);
    expect(res.body.isNewUser).toBeUndefined();
  });

  // 7. Opposite-role account rejection during Google Login
  it('7a. Existing Worker tries to log in via Recruiter Google Login -> safely rejected with clear guidance', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${workerEmail}`,
        expectedRole: 'RECRUITER',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid recruiter credentials/i);
    expect(res.body.message).toMatch(/Worker/i);
    expect(res.body.correctPortal).toBe('/login/worker');
  });

  it('7b. Existing Recruiter tries to log in via Worker Google Login -> safely rejected with clear guidance', async () => {
    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${recruiterEmail}`,
        expectedRole: 'WORKER',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid worker credentials/i);
    expect(res.body.message).toMatch(/Recruiter/i);
    expect(res.body.correctPortal).toBe('/login/recruiter');
  });

  // 8. Cross-role registration prevention
  it('8a. Attempt to register as Worker with email already registered as Recruiter -> rejected with direction', async () => {
    // Generate a new registration token
    const newWorkerTokenRes = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:temp_worker_${ts}@example.com`,
        expectedRole: 'WORKER',
      });

    const res = await request(app)
      .post('/api/auth/google/register/worker')
      .send({
        registrationToken: newWorkerTokenRes.body.registrationToken,
        formData: {
          fullName: 'Cross Test',
          profilePhoto: VALID_PHOTO_BASE64,
          location: 'Delhi',
          dob: '1995-01-01',
          phone: `+919813${String(ts).slice(-6)}`,
          email: recruiterEmail, // attempting to use recruiter email
          password: 'Password@123',
        },
      });

    // Mismatched token email or duplicate check
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 9. Password Login still works for Google-registered accounts
  it('9a. Google-registered Worker can log in with password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: workerEmail,
        password: 'Password@123',
        expectedRole: 'WORKER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe(ROLES.WORKER);
  });

  it('9b. Google-registered Recruiter can log in with password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: recruiterEmail,
        password: 'Password@123',
        expectedRole: 'RECRUITER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe(ROLES.RECRUITER);
  });

  // 10. Account status restrictions apply to Google Login
  it('10. Suspended/Blocked/Deactivated accounts cannot log in via Google', async () => {
    // Create a suspended account with linked google
    const suspendedEmail = `suspended_google_${ts}@example.com`;
    await User.create({
      email: suspendedEmail,
      passwordHash: await bcrypt.hash('Password@123', 10),
      role: ROLES.WORKER,
      status: 'SUSPENDED',
      phone: `+919814${String(ts).slice(-6)}`,
      googleId: `mock_google_sub_${Buffer.from(suspendedEmail).toString('hex')}`,
      googleLinked: true,
    });

    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${suspendedEmail}`,
        expectedRole: 'WORKER',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/suspended/i);
  });

  // 11. Admin accounts cannot log in via Google
  it('11. Admin accounts cannot use Google login', async () => {
    const adminEmail = `admin_google_${ts}@example.com`;
    await User.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash('Password@123', 10),
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      phone: `+919815${String(ts).slice(-6)}`,
    });

    const res = await request(app)
      .post('/api/auth/google/login')
      .send({
        idToken: `mock_google_token:${adminEmail}`,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/admin accounts cannot use google login/i);
  });
});
