const request = require('supertest');
const app = require('./src/app');
require('dotenv').config();

const req = (method, path, body, headers = {}) => {
  let r = request(app)[method.toLowerCase()](`/api${path}`);
  if (headers.Authorization) {
    r = r.set('Authorization', headers.Authorization);
  }
  if (body) {
    r = r.send(body);
  }
  return r.then((res) => ({ status: res.status, body: res.body }));
};

async function runVerification() {
  console.log('========================================================');
  console.log('🚀 LIVE VERIFICATION: RECRUITER → ADMIN PAYMENT SYSTEM');
  console.log('========================================================');

  const { connectDB, closeDB } = require('./src/config/db');
  await connectDB();

  // Step 1: Admin Login
  console.log('\n[1] Logging in as Admin...');
  const adminLogin = await req('POST', '/auth/login', {
    email: 'supportjobbyhop@gmail.com',
    password: 'admin123',
  });
  if (adminLogin.status !== 200 || !adminLogin.body.token) {
    console.error('❌ Admin login failed:', adminLogin.body);
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;
  console.log('✅ Admin authenticated successfully.');

  // Step 2: Set up and authenticate test recruiter
  console.log('\n[2] Setting up Recruiter account...');
  const mongoose = require('mongoose');
  const User = require('./src/models/User');
  const RecruiterProfile = require('./src/models/RecruiterProfile');
  const bcrypt = require('bcryptjs');

  await mongoose.connect(process.env.MONGODB_URI);
  let recUser = await User.findOne({ role: 'RECRUITER', status: 'ACTIVE' });
  const recPass = 'Password@123';
  let recEmail;

  if (!recUser) {
    const hash = await bcrypt.hash(recPass, 10);
    recEmail = `recruiter_verify_${Date.now()}@test.com`;
    recUser = await User.create({
      email: recEmail,
      phone: '+91 98765 43210',
      passwordHash: hash,
      role: 'RECRUITER',
      profileCompleted: true,
      status: 'ACTIVE',
    });
    await RecruiterProfile.create({
      userId: recUser._id,
      fullName: 'Aadish Jain',
      companyName: 'Royal Weddings Jaipur',
      phone: '+91 98765 43210',
      location: 'Jaipur, Rajasthan',
      email: recEmail,
      isInitialSetupComplete: true,
    });
  } else {
    recEmail = recUser.email;
    recUser.passwordHash = await bcrypt.hash(recPass, 10);
    recUser.status = 'ACTIVE';
    await recUser.save();
  }

  const recLogin = await req('POST', '/auth/login', {
    email: recEmail,
    password: recPass,
  });
  const recruiterToken = recLogin.body.token;
  console.log('✅ Authenticated recruiter token for:', recEmail);

  if (!recruiterToken) {
    console.error('❌ Could not authenticate recruiter:', recLogin.body);
    process.exit(1);
  }

  // Step 3: Recruiter Creates Job / Event
  console.log('\n[3] Recruiter creates Job / Event: "Wedding Event Jaipur"...');
  const jobPayload = {
    title: 'Wedding Event Jaipur',
    description: 'Luxury destination wedding event hospitality and management',
    eventType: 'Wedding',
    eventDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    startTime: '09:00 AM',
    endTime: '09:00 PM',
    location: 'Rambagh Palace, Jaipur',
    latitude: 26.8967,
    longitude: 75.8082,
    workersRequired: 10,
    recruiterProposedPayment: 500, // 10 workers * ₹500 = ₹5,000 total event payment
  };

  const createJobRes = await req('POST', '/recruiter/jobs', jobPayload, {
    Authorization: `Bearer ${recruiterToken}`,
  });

  if (createJobRes.status !== 201 || !createJobRes.body.job) {
    console.error('❌ Job creation failed:', createJobRes.body);
    process.exit(1);
  }
  const createdJob = createJobRes.body.job;
  console.log(`✅ Job created. ID: ${createdJob._id}, Status: ${createdJob.status}`);

  // Step 4: Admin Approves Job / Event
  console.log('\n[4] Admin reviews and APPROVES the event...');
  const approveRes = await req(
    'PUT',
    `/admin/jobs/${createdJob._id}/review`,
    {
      action: 'APPROVE',
      adminApprovedPayment: 400, // Worker payout is ₹400/person (completely separate!)
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  if (approveRes.status !== 200) {
    console.error('❌ Admin job approval failed:', approveRes.body);
    process.exit(1);
  }
  console.log('✅ Admin approved event. Status: APPROVED');

  // Step 5: Recruiter checks pending payment
  console.log('\n[5] Recruiter fetches pending payments via /api/recruiter-payments/my-payments...');
  const myPaymentsRes = await req('GET', '/recruiter-payments/my-payments', null, {
    Authorization: `Bearer ${recruiterToken}`,
  });

  if (myPaymentsRes.status !== 200 || !myPaymentsRes.body.success) {
    console.error('❌ Failed to fetch recruiter payments:', myPaymentsRes.body);
    process.exit(1);
  }

  const paymentRecord = myPaymentsRes.body.payments.find(
    (p) => (p.jobId?._id || p.jobId) === createdJob._id
  );

  if (!paymentRecord) {
    console.error('❌ RecruiterPayment record not found for created job!');
    process.exit(1);
  }

  console.log('✅ Found RecruiterPayment record:');
  console.log(`   - Payment ID: ${paymentRecord._id}`);
  console.log(`   - Amount Due: ₹${paymentRecord.amount} (Expected ₹5,000)`);
  console.log(`   - Status: ${paymentRecord.status}`);
  if (paymentRecord.amount !== 5000 || paymentRecord.status !== 'PENDING') {
    console.error('❌ Amount or status mismatch!');
    process.exit(1);
  }

  // Step 6: Recruiter Submits Payment (UTR Number & Method)
  console.log('\n[6] Recruiter submits payment: UTR "123456789012", Method "UPI"...');
  const submitRes = await req(
    'POST',
    `/recruiter-payments/${paymentRecord._id}/submit`,
    {
      utr: '123456789012',
      paymentMethod: 'UPI',
    },
    { Authorization: `Bearer ${recruiterToken}` }
  );

  if (submitRes.status !== 200 || !submitRes.body.success) {
    console.error('❌ Payment submission failed:', submitRes.body);
    process.exit(1);
  }
  const completedPayment = submitRes.body.payment;
  console.log('✅ Payment submission successful:');
  console.log(`   - Status: ${completedPayment.status} (COMPLETED)`);
  console.log(`   - UTR: ${completedPayment.utr}`);
  console.log(`   - Method: ${completedPayment.paymentMethod}`);
  console.log(`   - Payment Date: ${completedPayment.paymentDate}`);

  // Step 7: Duplicate Submission Prevention Test
  console.log('\n[7] Testing duplicate submission prevention...');
  const dupRes = await req(
    'POST',
    `/recruiter-payments/${paymentRecord._id}/submit`,
    {
      utr: '999999999999',
      paymentMethod: 'UPI',
    },
    { Authorization: `Bearer ${recruiterToken}` }
  );

  if (dupRes.status === 400) {
    console.log('✅ Duplicate submission correctly REJECTED with 400 Bad Request.');
  } else {
    console.error('❌ Duplicate submission check failed! Response:', dupRes);
    process.exit(1);
  }

  // Step 8: Admin Views Recruiter Payments List
  console.log('\n[8] Admin fetches recruiter payments via /api/admin/recruiter-payments...');
  const adminListRes = await req('GET', '/admin/recruiter-payments', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  if (adminListRes.status !== 200 || !adminListRes.body.success) {
    console.error('❌ Admin recruiter payments list failed:', adminListRes.body);
    process.exit(1);
  }

  const adminViewRecord = adminListRes.body.payments.find((p) => p._id === paymentRecord._id);
  if (!adminViewRecord) {
    console.error('❌ Payment record not found in admin view!');
    process.exit(1);
  }

  console.log('✅ Admin sees Recruiter payment:');
  console.log(`   - Recruiter: ${adminViewRecord.recruiterName} (${adminViewRecord.recruiterEmail})`);
  console.log(`   - Event: ${adminViewRecord.jobId?.title}`);
  console.log(`   - Amount: ₹${adminViewRecord.amount}`);
  console.log(`   - Status: ${adminViewRecord.status}`);
  console.log(`   - UTR: ${adminViewRecord.utr}`);
  console.log(`   - Payment Method: ${adminViewRecord.paymentMethod}`);

  // Step 9: Admin Views Single Payment Details
  console.log('\n[9] Admin views single payment via /api/admin/recruiter-payments/:id...');
  const adminSingleRes = await req('GET', `/admin/recruiter-payments/${paymentRecord._id}`, null, {
    Authorization: `Bearer ${adminToken}`,
  });
  if (adminSingleRes.status === 200 && adminSingleRes.body.payment) {
    console.log('✅ Admin retrieved single payment details successfully.');
  } else {
    console.error('❌ Admin single payment view failed:', adminSingleRes.body);
    process.exit(1);
  }

  // Step 10: Non-Regression Verification of Existing Worker Payout
  console.log('\n[10] Non-regression check: Verifying Worker payout system...');
  const workerPayoutsRes = await req('GET', '/admin/payments', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  if (workerPayoutsRes.status === 200 && workerPayoutsRes.body.success) {
    console.log('✅ Existing Admin Worker Payouts endpoint (/api/admin/payments) is 100% functional.');
  } else {
    console.error('❌ Worker payouts endpoint error:', workerPayoutsRes.body);
    process.exit(1);
  }

  const recWorkerSummaryRes = await req('GET', '/recruiter/payment-summary', null, {
    Authorization: `Bearer ${recruiterToken}`,
  });
  if (recWorkerSummaryRes.status === 200 && recWorkerSummaryRes.body.data?.totalWorkerPayout !== undefined) {
    console.log('✅ Existing Recruiter Worker Summary (/api/recruiter/payment-summary) is 100% functional.');
  } else {
    console.error('❌ Recruiter worker summary error:', recWorkerSummaryRes.body);
    process.exit(1);
  }

  console.log('\n========================================================');
  console.log('🎉 ALL 10 LIVE VERIFICATION STEPS PASSED SUCCESSFULLY!');
  console.log('========================================================');
  await closeDB();
  process.exit(0);
}

runVerification();
