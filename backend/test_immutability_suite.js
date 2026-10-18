const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTestSuite() {
  console.log('--- Starting Worker Immutability & Photo Upload Verification Suite ---');

  // Start in-memory mongo server
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  console.log('Connected to test in-memory MongoDB');

  // Now require app
  const app = require('./src/app');
  const OtpStore = require('./src/models/OtpStore');
  const User = require('./src/models/User');
  const WorkerProfile = require('./src/models/WorkerProfile');

  // Helper 1: Valid 1x1 JPEG in base64 (well under 1MB)
  // JPEG starts with FF D8 FF
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0xff, 0xd9
  ]);
  const validJpegDataUri = `data:image/jpeg;base64,${validJpegBuffer.toString('base64')}`;

  // Helper 2: Valid PNG in base64
  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
  ]);
  const validPngDataUri = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

  // Helper 3: Fake file (text file disguised as image)
  const fakeImageBuffer = Buffer.from('This is a text file not an image, hello world!');
  const fakeImageDataUri = `data:image/jpeg;base64,${fakeImageBuffer.toString('base64')}`;

  // Helper 4: Oversized image (> 1MB)
  const oversizedBuffer = Buffer.alloc(1024 * 1024 + 100); // 1MB + 100 bytes
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff;
  const oversizedDataUri = `data:image/jpeg;base64,${oversizedBuffer.toString('base64')}`;

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail}`);
      failedCount++;
    }
  }

  // TEST 1: Reject registration when profile photo > 1MB
  console.log('\n[Test 1] Registration rejects oversized photo (>1MB)');
  const res1 = await request(app)
    .post('/api/auth/register/worker')
    .send({
      fullName: 'John Doe',
      profilePhoto: oversizedDataUri,
      location: 'Mumbai, MH',
      dob: '2000-05-15',
      phone: '+91 9876543210',
      email: 'oversized@test.com',
      password: 'Password@123',
    });
  assert(
    res1.status === 400 && res1.body.message === 'Profile photo must be 1MB or smaller.',
    'Rejected >1MB with message "Profile photo must be 1MB or smaller."',
    `Status: ${res1.status}, Msg: ${res1.body?.message}`
  );

  // TEST 2: Reject registration when profile photo is invalid format (magic bytes inspection)
  console.log('\n[Test 2] Registration rejects fake/disguised photo format via MIME/magic bytes check');
  const res2 = await request(app)
    .post('/api/auth/register/worker')
    .send({
      fullName: 'John Doe',
      profilePhoto: fakeImageDataUri,
      location: 'Mumbai, MH',
      dob: '2000-05-15',
      phone: '+91 9876543211',
      email: 'fakephoto@test.com',
      password: 'Password@123',
    });
  assert(
    res2.status === 400 && res2.body.message === 'Only JPG, PNG, and WEBP formats are allowed for profile photo.',
    'Rejected disguised non-image format',
    `Status: ${res2.status}, Msg: ${res2.body?.message}`
  );

  // TEST 3: Successful registration with valid <= 1MB photo
  console.log('\n[Test 3] Successful registration with valid photo & verified OTP');
  const testEmail = 'worker_test@jobbyhop.com';
  await OtpStore.create({
    email: testEmail,
    otpHash: 'dummyhash',
    expiresAt: new Date(Date.now() + 300000),
    verified: true,
  });

  const res3 = await request(app)
    .post('/api/auth/register/worker')
    .send({
      fullName: 'Aarav Sharma',
      profilePhoto: validJpegDataUri,
      location: 'Mumbai, MH',
      dob: '2001-08-20',
      phone: '+91 9876543212',
      email: testEmail,
      password: 'Password@123',
      skills: ['Event Host', 'Usher'],
    });
  assert(res3.status === 201 && res3.body.token, 'Worker registered successfully', `Status: ${res3.status}`);
  const workerToken = res3.body.token;

  // TEST 4: Backend rejects modification of Full Legal Name
  console.log('\n[Test 4] Backend rejects modification of Full Legal Name');
  const res4 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      fullName: 'Aarav Hacked',
    });
  assert(
    res4.status === 403 &&
    res4.body.message === 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
    'Rejected fullName change with 403',
    `Status: ${res4.status}, Msg: ${res4.body?.message}`
  );

  // TEST 5: Backend rejects modification of Date of Birth
  console.log('\n[Test 5] Backend rejects modification of Date of Birth');
  const res5 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      dateOfBirth: '1995-01-01',
    });
  assert(
    res5.status === 403 &&
    res5.body.message === 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
    'Rejected dateOfBirth change with 403',
    `Status: ${res5.status}, Msg: ${res5.body?.message}`
  );

  // TEST 6: Backend rejects modification of Phone Number
  console.log('\n[Test 6] Backend rejects modification of Phone Number');
  const res6 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      phoneNumber: '+91 9999999999',
    });
  assert(
    res6.status === 403 &&
    res6.body.message === 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
    'Rejected phone change with 403',
    `Status: ${res6.status}, Msg: ${res6.body?.message}`
  );

  // TEST 7: Backend rejects modification / replacement of Profile Photo
  console.log('\n[Test 7] Backend rejects replacement of Profile Photo');
  const res7 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      profilePhoto: validPngDataUri, // Different photo
    });
  assert(
    res7.status === 403 &&
    res7.body.message === 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
    'Rejected profilePhoto replacement with 403',
    `Status: ${res7.status}, Msg: ${res7.body?.message}`
  );

  // TEST 8: Backend rejects removing profile photo (empty string)
  console.log('\n[Test 8] Backend rejects removing Profile Photo');
  const res8 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      profilePhoto: '',
    });
  assert(
    res8.status === 403,
    'Rejected removal of profile photo',
    `Status: ${res8.status}, Msg: ${res8.body?.message}`
  );

  // TEST 9: Allowed fields update cleanly (location, skills, bio, preferredEventTypes)
  console.log('\n[Test 9] Allowed fields update successfully');
  const res9 = await request(app)
    .put('/api/worker/profile')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      fullName: 'Aarav Sharma', // Same unchanged value
      dob: '2001-08-20',        // Same unchanged value
      phone: '+91 9876543212',  // Same unchanged value
      profilePhoto: validJpegDataUri, // Same unchanged value
      location: 'Bandra West, Mumbai',
      skills: ['VIP Relations', 'Stage Usher'],
      bio: 'Experienced corporate event hostess.',
    });
  assert(
    res9.status === 200 && res9.body.profile.location === 'Bandra West, Mumbai',
    'Allowed fields updated without altering immutable fields',
    `Status: ${res9.status}, Location: ${res9.body?.profile?.location}`
  );

  // TEST 10: Verify DB values remained unchanged
  console.log('\n[Test 10] Verify database values for immutable fields are untouched');
  const profileInDb = await WorkerProfile.findOne({ email: testEmail });
  assert(
    profileInDb.fullName === 'Aarav Sharma' &&
    profileInDb.phone === '+91 9876543212' &&
    (profileInDb.profilePhoto === validJpegDataUri || (typeof profileInDb.profilePhoto === 'string' && profileInDb.profilePhoto.startsWith('/uploads/'))) &&
    profileInDb.dob.toISOString().split('T')[0] === '2001-08-20',
    'Database values for all 4 personal details remain original',
    `DB: ${profileInDb.fullName}, ${profileInDb.phone}`
  );

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(failedCount > 0 ? 1 : 0);
}

runTestSuite().catch((err) => {
  console.error('Test Suite encountered error:', err);
  process.exit(1);
});
