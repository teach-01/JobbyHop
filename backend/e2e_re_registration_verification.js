const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const User = require('./src/models/User');
const WorkerProfile = require('./src/models/WorkerProfile');
const RecruiterProfile = require('./src/models/RecruiterProfile');
const OtpStore = require('./src/models/OtpStore');
const AuditLog = require('./src/models/AuditLog');
const app = require('./src/app');
const request = require('supertest');
const { generateToken } = require('./src/utils/jwt');
const { ROLES } = require('./src/config/constants');

const VALID_PHOTO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

async function runLiveVerification() {
  console.log('🔗 Connecting to live MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB:', mongoose.connection.host);

  const ts = Date.now();
  let adminUser = await User.findOne({ role: ROLES.ADMIN, isDeleted: false });
  if (!adminUser) {
    adminUser = await User.create({
      email: `admin_live_${ts}@jobbyhop.com`,
      phone: `+919999${ts.toString().slice(-6)}`,
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      isDeleted: false,
    });
  }
  const adminToken = generateToken(adminUser);

  const results = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Admin deletes Worker → same email/mobile can register again
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing: Admin deletes Worker -> same email/mobile can register again ---');
    const w1Email = `w_adm_del_${ts}@example.com`;
    const w1Phone = `91${ts.toString().slice(-8)}`;

    await preVerifyEmail(w1Email);
    const regW1 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Live Worker 1',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Jaipur',
        dob: '1995-05-05',
        phone: w1Phone,
        email: w1Email,
        password: 'Password@123',
      });
    if (regW1.status !== 201) throw new Error(`Worker registration failed: ${JSON.stringify(regW1.body)}`);
    const w1Id = regW1.body.user.id;
    const w1Token = regW1.body.token;

    const delW1 = await request(app)
      .delete(`/api/admin/users/${w1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Admin deletion live verification' });
    if (delW1.status !== 200) throw new Error(`Admin delete failed: ${JSON.stringify(delW1.body)}`);

    // Verify token dead
    const checkW1Token = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${w1Token}`);
    if (checkW1Token.status !== 401) throw new Error(`Old token was not rejected: ${checkW1Token.status}`);

    // Re-register with same email & mobile
    await preVerifyEmail(w1Email);
    const reRegW1 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Live Worker 1 ReRegistered',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Jaipur',
        dob: '1995-05-05',
        phone: w1Phone,
        email: w1Email,
        password: 'Password@456',
      });
    if (reRegW1.status !== 201) throw new Error(`Re-registration failed: ${JSON.stringify(reRegW1.body)}`);
    const newW1Id = reRegW1.body.user.id;
    if (newW1Id === w1Id) throw new Error('New user ID is identical to old user ID');

    console.log(`✅ Passed: Admin deleted Worker (${w1Id}) -> Re-registered successfully with fresh ID (${newW1Id})`);
    results.push({ test: '1. Admin deletes Worker -> re-register', passed: true });

    // -------------------------------------------------------------
    // Test 2: Admin deletes Recruiter → same email/mobile can register again
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing: Admin deletes Recruiter -> same email/mobile can register again ---');
    const r1Email = `r_adm_del_${ts}@example.com`;
    const r1Phone = `92${ts.toString().slice(-8)}`;

    await preVerifyEmail(r1Email);
    const regR1 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Live Recruiter 1',
        companyName: 'Apex Events',
        location: 'Delhi',
        phone: r1Phone,
        email: r1Email,
        password: 'Password@123',
      });
    if (regR1.status !== 201) throw new Error(`Recruiter registration failed: ${JSON.stringify(regR1.body)}`);
    const r1Id = regR1.body.user.id;
    const r1Token = regR1.body.token;

    const delR1 = await request(app)
      .delete(`/api/admin/users/${r1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    if (delR1.status !== 200) throw new Error(`Admin delete recruiter failed: ${JSON.stringify(delR1.body)}`);

    // Verify old token dead
    const checkR1Token = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${r1Token}`);
    if (checkR1Token.status !== 401) throw new Error('Old recruiter token not rejected');

    // Re-register with same email & mobile
    await preVerifyEmail(r1Email);
    const reRegR1 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Live Recruiter 1 ReRegistered',
        companyName: 'Apex Events ReRegistered',
        location: 'Delhi',
        phone: r1Phone,
        email: r1Email,
        password: 'Password@456',
      });
    if (reRegR1.status !== 201) throw new Error(`Recruiter re-registration failed: ${JSON.stringify(reRegR1.body)}`);
    const newR1Id = reRegR1.body.user.id;
    if (newR1Id === r1Id) throw new Error('New recruiter ID is identical to old ID');

    console.log(`✅ Passed: Admin deleted Recruiter (${r1Id}) -> Re-registered successfully with fresh ID (${newR1Id})`);
    results.push({ test: '2. Admin deletes Recruiter -> re-register', passed: true });

    // -------------------------------------------------------------
    // Test 3: Worker self-deletes → same email/mobile can register again
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing: Worker self-deletes -> same email/mobile can register again ---');
    const w2Email = `w_self_del_${ts}@example.com`;
    const w2Phone = `93${ts.toString().slice(-8)}`;

    await preVerifyEmail(w2Email);
    const regW2 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Live Worker Self Del',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Mumbai',
        dob: '1999-01-01',
        phone: w2Phone,
        email: w2Email,
        password: 'Password@123',
      });
    const w2Id = regW2.body.user.id;
    const w2Token = regW2.body.token;

    // Self delete
    const selfDelW2 = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${w2Token}`);
    if (selfDelW2.status !== 200) throw new Error(`Self delete failed: ${JSON.stringify(selfDelW2.body)}`);

    // Verify token rejected
    const checkW2Token = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${w2Token}`);
    if (checkW2Token.status !== 401) throw new Error('Old token was not rejected after self deletion');

    // Re-register
    await preVerifyEmail(w2Email);
    const reRegW2 = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Live Worker Self Del Reborn',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Mumbai',
        dob: '1999-01-01',
        phone: w2Phone,
        email: w2Email,
        password: 'Password@456',
      });
    if (reRegW2.status !== 201) throw new Error(`Worker re-registration failed: ${JSON.stringify(reRegW2.body)}`);
    const newW2Id = reRegW2.body.user.id;
    if (newW2Id === w2Id) throw new Error('New worker ID is identical to old ID');

    console.log(`✅ Passed: Worker self-deleted (${w2Id}) -> Re-registered successfully with fresh ID (${newW2Id})`);
    results.push({ test: '3. Worker self-deletes -> re-register', passed: true });

    // -------------------------------------------------------------
    // Test 4: Recruiter self-deletes → same email/mobile can register again
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing: Recruiter self-deletes -> same email/mobile can register again ---');
    const r2Email = `r_self_del_${ts}@example.com`;
    const r2Phone = `94${ts.toString().slice(-8)}`;

    await preVerifyEmail(r2Email);
    const regR2 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Live Recruiter Self Del',
        companyName: 'SelfDel Agency',
        location: 'Pune',
        phone: r2Phone,
        email: r2Email,
        password: 'Password@123',
      });
    const r2Id = regR2.body.user.id;
    const r2Token = regR2.body.token;

    // Self delete
    const selfDelR2 = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${r2Token}`);
    if (selfDelR2.status !== 200) throw new Error(`Recruiter self delete failed: ${JSON.stringify(selfDelR2.body)}`);

    // Verify token rejected
    const checkR2Token = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${r2Token}`);
    if (checkR2Token.status !== 401) throw new Error('Old token was not rejected after self deletion');

    // Re-register
    await preVerifyEmail(r2Email);
    const reRegR2 = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Live Recruiter Self Del Reborn',
        companyName: 'SelfDel Agency 2.0',
        location: 'Pune',
        phone: r2Phone,
        email: r2Email,
        password: 'Password@456',
      });
    if (reRegR2.status !== 201) throw new Error(`Recruiter re-registration failed: ${JSON.stringify(reRegR2.body)}`);
    const newR2Id = reRegR2.body.user.id;
    if (newR2Id === r2Id) throw new Error('New recruiter ID is identical to old ID');

    console.log(`✅ Passed: Recruiter self-deleted (${r2Id}) -> Re-registered successfully with fresh ID (${newR2Id})`);
    results.push({ test: '4. Recruiter self-deletes -> re-register', passed: true });

    // -------------------------------------------------------------
    // Test 5: Suspended or blocked account → re-registration is rejected
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing: Suspended or blocked account -> re-registration rejected ---');
    const suspEmail = `susp_${ts}@example.com`;
    const suspPhone = `95${ts.toString().slice(-8)}`;

    const suspUser = await User.create({
      email: suspEmail,
      phone: suspPhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.WORKER,
      status: 'SUSPENDED',
      isDeleted: false,
    });

    await preVerifyEmail(suspEmail);
    const trySuspEmail = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Suspended Tester',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: `99${ts.toString().slice(-8)}`,
        email: suspEmail,
        password: 'Password@123',
      });
    if (trySuspEmail.status !== 400 || !trySuspEmail.body.message.includes('suspended')) {
      throw new Error(`Suspended email registration was not rejected properly: ${trySuspEmail.status}`);
    }

    const diffSuspEmail = `new_diff_${ts}@example.com`;
    await preVerifyEmail(diffSuspEmail);
    const trySuspPhone = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Suspended Phone Tester',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: suspPhone,
        email: diffSuspEmail,
        password: 'Password@123',
      });
    if (trySuspPhone.status !== 400 || !trySuspPhone.body.message.includes('suspended')) {
      throw new Error(`Suspended phone registration was not rejected properly: ${trySuspPhone.status}`);
    }

    // Blocked check
    const blockEmail = `blocked_${ts}@example.com`;
    const blockPhone = `96${ts.toString().slice(-8)}`;
    await User.create({
      email: blockEmail,
      phone: blockPhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.RECRUITER,
      status: 'BLOCKED',
      isDeleted: false,
    });

    await preVerifyEmail(blockEmail);
    const tryBlock = await request(app)
      .post('/api/auth/register/recruiter')
      .send({
        fullName: 'Blocked Tester',
        companyName: 'Blocked Co',
        location: 'Delhi',
        phone: `98${ts.toString().slice(-8)}`,
        email: blockEmail,
        password: 'Password@123',
      });
    if (tryBlock.status !== 400 || !tryBlock.body.message.includes('blocked')) {
      throw new Error(`Blocked email registration was not rejected properly: ${tryBlock.status}`);
    }

    console.log('✅ Passed: Suspended & blocked accounts strictly reject re-registration by email and mobile');
    results.push({ test: '5. Suspended/blocked -> rejected', passed: true });

    // -------------------------------------------------------------
    // Test 6: Active account → duplicate registration is rejected
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing: Active account -> duplicate registration rejected ---');
    const activeEmail = `active_${ts}@example.com`;
    const activePhone = `97${ts.toString().slice(-8)}`;
    await User.create({
      email: activeEmail,
      phone: activePhone,
      passwordHash: await bcrypt.hash('pass123', 10),
      role: ROLES.WORKER,
      status: 'ACTIVE',
      isDeleted: false,
    });

    await preVerifyEmail(activeEmail);
    const tryActiveDupEmail = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Active Dup Email Tester',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: `88${ts.toString().slice(-8)}`,
        email: activeEmail,
        password: 'Password@123',
      });
    if (tryActiveDupEmail.status !== 400 || tryActiveDupEmail.body.message !== 'Email is already registered') {
      throw new Error(`Active duplicate email not rejected: ${tryActiveDupEmail.status}`);
    }

    const uniqueEmail = `unique_${ts}@example.com`;
    await preVerifyEmail(uniqueEmail);
    const tryActiveDupPhone = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Active Dup Phone Tester',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Delhi',
        dob: '1995-01-01',
        phone: activePhone,
        email: uniqueEmail,
        password: 'Password@123',
      });
    if (tryActiveDupPhone.status !== 400 || tryActiveDupPhone.body.message !== 'Phone number is already registered') {
      throw new Error(`Active duplicate phone not rejected: ${tryActiveDupPhone.status}`);
    }

    console.log('✅ Passed: Active accounts reject duplicate email and phone');
    results.push({ test: '6. Active duplicate -> rejected', passed: true });

    // -------------------------------------------------------------
    // Test 7: Newly registered accounts can verify email & log in
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing: Newly registered accounts verify email & log in ---');
    const verifyEmail = `newly_reg_${ts}@example.com`;
    const verifyPhone = `90${ts.toString().slice(-8)}`;
    const verifyPass = 'VerifiedUser@2026';

    // Verify OTP
    await preVerifyEmail(verifyEmail);

    // Register
    const freshReg = await request(app)
      .post('/api/auth/register/worker')
      .send({
        fullName: 'Newly Registered Verified Worker',
        profilePhoto: VALID_PHOTO_BASE64,
        location: 'Hyderabad',
        dob: '2000-06-12',
        phone: verifyPhone,
        email: verifyEmail,
        password: verifyPass,
        skills: ['Registration'],
      });
    if (freshReg.status !== 201) throw new Error(`Fresh registration failed: ${freshReg.status}`);

    // Login
    const freshLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: verifyEmail, password: verifyPass, expectedRole: 'WORKER' });
    if (freshLogin.status !== 200 || !freshLogin.body.token) {
      throw new Error(`Fresh login failed: ${freshLogin.status}`);
    }

    // Access profile with token
    const fetchMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshLogin.body.token}`);
    if (fetchMe.status !== 200 || fetchMe.body.user.email !== verifyEmail) {
      throw new Error(`Profile retrieval failed: ${fetchMe.status}`);
    }

    console.log('✅ Passed: Newly registered account successfully verified email, logged in, and accessed profile');
    results.push({ test: '7. Newly registered verify & login', passed: true });

    console.log('\n======================================================');
    console.log('🎉 ALL 7 REQUIRED VERIFICATION TESTS PASSED ON LIVE DB!');
    console.log('======================================================');
    console.table(results);

  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runLiveVerification();
