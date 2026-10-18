const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB } = require('../config/db');
const { seedDatabase } = require('../utils/seedData');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const Job = require('../models/Job');
const RecruiterPayment = require('../models/RecruiterPayment');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment'); // Worker payment model
const bcrypt = require('bcryptjs');

describe('Recruiter → Admin Payment System Integration Tests', () => {
  let adminToken;
  let recruiterToken;
  let recruiter2Token;
  let recruiterUser;
  let recruiter2User;
  let approvedJob;
  let paymentRecord;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();

    // Login as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'supportjobbyhop@gmail.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Create Recruiter 1
    const passwordHash = await bcrypt.hash('password123', 10);
    recruiterUser = await User.create({
      email: 'recruiter_payment_test@eventco.com',
      passwordHash,
      phone: '+91 99999 11111',
      role: 'RECRUITER',
      profileCompleted: true,
    });
    await RecruiterProfile.create({
      userId: recruiterUser._id,
      fullName: 'Aadish Jain',
      companyName: 'Royal Weddings',
      location: 'Jaipur, Rajasthan',
      phone: '+91 99999 11111',
      email: 'recruiter_payment_test@eventco.com',
      isInitialSetupComplete: true,
    });

    const recRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter_payment_test@eventco.com', password: 'password123' });
    recruiterToken = recRes.body.token;

    // Create Recruiter 2 (for authorization tests)
    recruiter2User = await User.create({
      email: 'recruiter_other@eventco.com',
      passwordHash,
      phone: '+91 99999 22222',
      role: 'RECRUITER',
      profileCompleted: true,
    });
    await RecruiterProfile.create({
      userId: recruiter2User._id,
      fullName: 'Other Recruiter',
      companyName: 'Other Corp',
      location: 'Delhi',
      phone: '+91 99999 22222',
      email: 'recruiter_other@eventco.com',
      isInitialSetupComplete: true,
    });

    const rec2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter_other@eventco.com', password: 'password123' });
    recruiter2Token = rec2Res.body.token;
  });

  afterAll(async () => {
    await closeDB();
  });

  test('Step 1: Recruiter creates a Job/Event and Admin approves it', async () => {
    // Recruiter submits job
    const createRes = await request(app)
      .post('/api/recruiter/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        title: 'Wedding Event Jaipur',
        description: 'Elite royal wedding event support',
        eventType: 'Wedding',
        eventDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        startTime: '10:00 AM',
        endTime: '08:00 PM',
        location: 'Jaipur Palace, Rajasthan',
        latitude: 26.9124,
        longitude: 75.7873,
        workersRequired: 10,
        recruiterProposedPayment: 500, // 10 workers * 500 = 5000 total offer
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const jobId = createRes.body.job._id;

    // Admin approves the job
    const approveRes = await request(app)
      .put(`/api/admin/jobs/${jobId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'APPROVE',
        adminApprovedPayment: 450, // Worker payout rate set by admin is separate
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    approvedJob = await Job.findById(jobId);
    expect(approvedJob.status).toBe('APPROVED');
    // Verify recruiterPaymentAmount is calculated from the event offer (5000)
    expect(approvedJob.recruiterPaymentAmount).toBe(5000);
    expect(approvedJob.recruiterPaymentStatus).toBe('PENDING');

    // Verify RecruiterPayment record was created
    paymentRecord = await RecruiterPayment.findOne({ jobId: approvedJob._id });
    expect(paymentRecord).toBeTruthy();
    expect(paymentRecord.amount).toBe(5000);
    expect(paymentRecord.status).toBe('PENDING');
  });

  test('Step 2: Recruiter sees pending payment in my-payments', async () => {
    const res = await request(app)
      .get('/api/recruiter-payments/my-payments')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.payments.length).toBeGreaterThanOrEqual(1);

    const myPayment = res.body.payments.find((p) => p.jobId?._id === approvedJob._id.toString());
    expect(myPayment).toBeTruthy();
    expect(myPayment.amount).toBe(5000);
    expect(myPayment.status).toBe('PENDING');
    expect(res.body.summary.pendingAmount).toBeGreaterThanOrEqual(5000);
  });

  test('Step 3: Security - Another recruiter cannot view or submit payment for this record', async () => {
    // Attempt to view
    const viewRes = await request(app)
      .get(`/api/recruiter-payments/${paymentRecord._id}`)
      .set('Authorization', `Bearer ${recruiter2Token}`);
    expect(viewRes.status).toBe(403);

    // Attempt to submit
    const submitRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiter2Token}`)
      .send({
        utr: '123456789012',
        paymentMethod: 'UPI',
      });
    expect(submitRes.status).toBe(403);
  });

  test('Step 4: Validation - Empty or invalid UTR is rejected', async () => {
    // Missing UTR
    const missingRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        paymentMethod: 'UPI',
      });
    expect(missingRes.status).toBe(400);

    // Whitespace only
    const whitespaceRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        utr: '    ',
        paymentMethod: 'UPI',
      });
    expect(whitespaceRes.status).toBe(400);

    // Too short UTR
    const shortRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        utr: '123',
        paymentMethod: 'UPI',
      });
    expect(shortRes.status).toBe(400);
  });

  test('Step 5: Successful Payment Submission by Recruiter', async () => {
    const utrValue = '123456789012';
    const submitRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        utr: `  ${utrValue}  `, // should trim
        paymentMethod: 'UPI',
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.payment.status).toBe('COMPLETED');
    expect(submitRes.body.payment.utr).toBe(utrValue);
    expect(submitRes.body.payment.paymentMethod).toBe('UPI');
    expect(submitRes.body.payment.paymentDate).toBeTruthy();

    // Verify DB update
    const updatedPayment = await RecruiterPayment.findById(paymentRecord._id);
    expect(updatedPayment.status).toBe('COMPLETED');
    expect(updatedPayment.utr).toBe(utrValue);

    // Verify Job recruiterPaymentStatus
    const updatedJob = await Job.findById(approvedJob._id);
    expect(updatedJob.recruiterPaymentStatus).toBe('COMPLETED');
  });

  test('Step 6: Duplicate payment submission is prevented', async () => {
    const dupRes = await request(app)
      .post(`/api/recruiter-payments/${paymentRecord._id}/submit`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        utr: '999999999999',
        paymentMethod: 'UPI',
      });

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.message).toMatch(/already been completed/i);
  });

  test('Step 7: Audit Log and Admin Notifications created', async () => {
    // Check Audit Log
    const audit = await AuditLog.findOne({
      entityName: 'RecruiterPayment',
      entityId: paymentRecord._id,
      action: 'RECRUITER_PAYMENT_COMPLETED',
    });
    expect(audit).toBeTruthy();
    expect(audit.newValue.amount).toBe(5000);
    expect(audit.newValue.utr).toBe('123456789012');
    expect(audit.performedByRole).toBe('RECRUITER');

    // Check Admin notification
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const notif = await Notification.findOne({
      userId: adminUser._id,
      type: 'RECRUITER_PAYMENT_RECEIVED',
      relatedEntityId: paymentRecord._id,
    });
    expect(notif).toBeTruthy();
    expect(notif.message).toContain('Aadish Jain');
    expect(notif.message).toContain('Wedding Event Jaipur');
  });

  test('Step 8: Admin can view Recruiter Payment record and all payments list', async () => {
    const listRes = await request(app)
      .get('/api/admin/recruiter-payments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.payments.length).toBeGreaterThanOrEqual(1);

    const found = listRes.body.payments.find((p) => p._id === paymentRecord._id.toString());
    expect(found).toBeTruthy();
    expect(found.recruiterName).toBe('Aadish Jain');
    expect(found.recruiterEmail).toBe('recruiter_payment_test@eventco.com');
    expect(found.amount).toBe(5000);
    expect(found.status).toBe('COMPLETED');
    expect(found.utr).toBe('123456789012');
    expect(found.paymentMethod).toBe('UPI');

    // View single
    const singleRes = await request(app)
      .get(`/api/admin/recruiter-payments/${paymentRecord._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.payment._id).toBe(paymentRecord._id.toString());
  });

  test('Step 9: Non-regression check: Worker Payment functionality is untouched and working', async () => {
    // Existing admin worker payments endpoint
    const workerPaymentsRes = await request(app)
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(workerPaymentsRes.status).toBe(200);
    expect(workerPaymentsRes.body.success).toBe(true);

    // Recruiter payment summary hides worker payouts
    const recSummaryRes = await request(app)
      .get('/api/recruiter/payment-summary')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(recSummaryRes.status).toBe(200);
    expect(recSummaryRes.body.success).toBe(true);
    expect(recSummaryRes.body.data).toBeNull();
  });
});
