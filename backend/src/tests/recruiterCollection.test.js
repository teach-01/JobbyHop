const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB } = require('../config/db');
const { seedDatabase } = require('../utils/seedData');
const User = require('../models/User');
const RecruiterProfile = require('../models/RecruiterProfile');
const Job = require('../models/Job');
const RecruiterCollection = require('../models/RecruiterCollection');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

describe('Recruiter Collections (Recruiter → Admin) Integration Tests', () => {
  let adminToken;
  let recruiterToken;
  let workerToken;
  let recruiterUser;
  let workerUser;
  let testJob;
  let testCollection;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();

    // Login as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'supportjobbyhop@gmail.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Create Recruiter
    const passwordHash = await bcrypt.hash('password123', 10);
    recruiterUser = await User.create({
      email: 'recruiter_col_test@eventco.com',
      passwordHash,
      phone: '+91 99999 22222',
      role: 'RECRUITER',
      profileCompleted: true,
    });
    await RecruiterProfile.create({
      userId: recruiterUser._id,
      fullName: 'Aadish Collections',
      companyName: 'Grand Events Co',
      location: 'Mumbai, Maharashtra',
      phone: '+91 99999 22222',
      email: 'recruiter_col_test@eventco.com',
      isInitialSetupComplete: true,
    });

    const recRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter_col_test@eventco.com', password: 'password123' });
    recruiterToken = recRes.body.token;

    // Create Worker
    workerUser = await User.create({
      email: 'worker_col_test@staff.com',
      passwordHash,
      phone: '+91 88888 33333',
      role: 'WORKER',
      profileCompleted: true,
    });

    const wrkRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'worker_col_test@staff.com', password: 'password123' });
    workerToken = wrkRes.body.token;

    // Create Approved Job
    testJob = await Job.create({
      title: 'Grand Gala Collection Test Event',
      description: 'Exclusive gala event for recruiter collection workflow testing',
      eventType: 'Corporate Function',
      startTime: '10:00',
      endTime: '18:00',
      recruiterId: recruiterUser._id,
      recruiterProposedPayment: 3000,
      workersRequired: 5,
      recruiterPaymentAmount: 15000,
      adminApprovedPayment: 2500,
      eventDate: new Date('2026-11-20'),
      location: 'Mumbai, Maharashtra',
      status: 'APPROVED',
      recruiterPaymentStatus: 'PENDING',
    });

    // Create Worker Payment to verify data isolation
    await Payment.create({
      workerId: workerUser._id,
      jobId: testJob._id,
      assignmentId: new (require('mongoose').Types.ObjectId)(),
      amount: 2500,
      expectedPaymentDate: new Date('2026-11-25'),
      status: 'PENDING',
    });
  });

  afterAll(async () => {
    await closeDB();
  });

  test('1. Recruiter collections auto-sync for approved jobs and return PENDING status', async () => {
    const res = await request(app)
      .get('/api/recruiter-collections/my-collections')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collections.length).toBeGreaterThan(0);

    const col = res.body.collections.find((c) => c.jobId?._id?.toString() === testJob._id.toString());
    expect(col).toBeDefined();
    expect(col.status).toBe('PENDING');
    expect(col.amount).toBe(15000);
    testCollection = col;
  });

  test('2. Recruiter submits collection payment with valid UTR via POST /api/recruiter/recruiter-collections', async () => {
    const res = await request(app)
      .post('/api/recruiter/recruiter-collections')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        collectionId: testCollection._id,
        utrNumber: 'HDFC98765432101',
        paymentMethod: 'UPI',
        notes: 'Transferred from corporate HDFC UPI account',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collection.status).toBe('PROCESSING');
    expect(res.body.collection.utrNumber).toBe('HDFC98765432101');
  });

  test('3. Duplicate confirmed UTR is rejected on submission', async () => {
    // Create another collection marked as PAID with this UTR
    const job2 = await Job.create({
      title: 'Second Test Job',
      description: 'Second description',
      eventType: 'Corporate Function',
      startTime: '10:00',
      endTime: '18:00',
      location: 'Mumbai, Maharashtra',
      recruiterId: recruiterUser._id,
      recruiterProposedPayment: 1000,
      workersRequired: 1,
      eventDate: new Date('2026-12-01'),
      status: 'APPROVED',
    });

    const col2 = await RecruiterCollection.create({
      recruiterId: recruiterUser._id,
      jobId: job2._id,
      amount: 1000,
      status: 'PAID',
      utrNumber: 'PAID_CONFIRMED_UTR_12345',
    });

    const job3 = await Job.create({
      title: 'Third Test Job',
      description: 'Third description',
      eventType: 'Corporate Function',
      startTime: '10:00',
      endTime: '18:00',
      location: 'Mumbai, Maharashtra',
      recruiterId: recruiterUser._id,
      recruiterProposedPayment: 1000,
      workersRequired: 1,
      eventDate: new Date('2026-12-02'),
      status: 'APPROVED',
    });

    const col3 = await RecruiterCollection.create({
      recruiterId: recruiterUser._id,
      jobId: job3._id,
      amount: 1000,
      status: 'PENDING',
    });

    const res = await request(app)
      .post('/api/recruiter/recruiter-collections')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        collectionId: col3._id,
        utrNumber: 'PAID_CONFIRMED_UTR_12345',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('4. Admin can retrieve all recruiter collections with summary stats via GET /api/admin/recruiter-collections', async () => {
    const res = await request(app)
      .get('/api/admin/recruiter-collections')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.collections)).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary.totalCount).toBe('number');

    const item = res.body.collections.find((c) => c._id.toString() === testCollection._id.toString());
    expect(item).toBeDefined();
    expect(item.utrNumber).toBe('HDFC98765432101');
    expect(item.recruiterName).toBe('Aadish Collections');
    expect(item.status).toBe('PROCESSING');
  });

  test('5. Admin can retrieve single collection record details via GET /api/admin/recruiter-collections/:id', async () => {
    const res = await request(app)
      .get(`/api/admin/recruiter-collections/${testCollection._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collection._id.toString()).toBe(testCollection._id.toString());
    expect(res.body.recruiterProfile).toBeDefined();
  });

  test('6. Admin can update collection status to PAID via PATCH /api/admin/recruiter-collections/:id/status', async () => {
    const res = await request(app)
      .patch(`/api/admin/recruiter-collections/${testCollection._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'PAID',
        adminNotes: 'Bank transaction credit confirmed',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collection.status).toBe('PAID');
    expect(res.body.collection.adminNotes).toBe('Bank transaction credit confirmed');

    // Verify audit log
    const auditLog = await AuditLog.findOne({
      entityName: 'RecruiterCollection',
      entityId: testCollection._id,
      action: 'RECRUITER_COLLECTION_MARKED_PAID',
    });
    expect(auditLog).toBeDefined();

    // Verify notification to recruiter
    const notif = await Notification.findOne({
      userId: recruiterUser._id,
      type: 'PAYMENT_VERIFIED',
    });
    expect(notif).toBeDefined();
  });

  test('7. Admin can update collection status to REJECTED with feedback notes', async () => {
    // Reset to REJECTED for testing
    const res = await request(app)
      .patch(`/api/admin/recruiter-collections/${testCollection._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'REJECTED',
        adminNotes: 'UTR not reflected in current statement. Please recheck and resubmit.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collection.status).toBe('REJECTED');

    // Verify audit log
    const auditLog = await AuditLog.findOne({
      entityName: 'RecruiterCollection',
      entityId: testCollection._id,
      action: 'RECRUITER_COLLECTION_REJECTED',
    });
    expect(auditLog).toBeDefined();
  });

  test('8. Data Isolation: Worker payout records do NOT appear in Recruiter Collections', async () => {
    const res = await request(app)
      .get('/api/admin/recruiter-collections')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const workerPayoutIds = (await Payment.find()).map((p) => p._id.toString());
    const collectionIds = res.body.collections.map((c) => c._id.toString());

    // None of worker payment IDs should be present in collections
    for (const pId of workerPayoutIds) {
      expect(collectionIds).not.toContain(pId);
    }
  });

  test('9. RBAC: Workers cannot access admin recruiter collections or modify status', async () => {
    const getRes = await request(app)
      .get('/api/admin/recruiter-collections')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/admin/recruiter-collections/${testCollection._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'PAID' });
    expect(patchRes.status).toBe(403);
  });
});
