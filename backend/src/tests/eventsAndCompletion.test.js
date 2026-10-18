const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB } = require('../config/db');
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');

describe('Admin Events & Completion Lifecycle Tests', () => {
  let adminToken;
  let recruiterToken;
  let recruiterUser;
  let testJob;
  let adminUser;

  beforeAll(async () => {
    await connectDB();

    // Ensure Admin user exists
    let admin = await User.findOne({ email: 'supportjobbyhop@gmail.com' });
    if (!admin) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      admin = await User.create({
        email: 'supportjobbyhop@gmail.com',
        passwordHash,
        phone: '+91 98888 77777',
        role: 'ADMIN',
        profileCompleted: true,
      });
    }
    adminUser = admin;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'supportjobbyhop@gmail.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Recruiter login for auth checks
    let recruiter = await User.findOne({ role: 'RECRUITER' });
    if (!recruiter) {
      const passwordHash = await bcrypt.hash('recruiter123', 10);
      recruiter = await User.create({
        email: 'recruiter_test@jobbyhop.com',
        passwordHash,
        phone: '+91 91111 22222',
        role: 'RECRUITER',
        profileCompleted: true,
      });
    }
    recruiterUser = recruiter;

    // Set known password on recruiter for login
    recruiter.passwordHash = await bcrypt.hash('password123', 10);
    await recruiter.save();
    const recruiterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: recruiter.email, password: 'password123' });
    recruiterToken = recruiterLogin.body.token;
  });

  afterAll(async () => {
    if (testJob?._id) {
      await Job.findByIdAndDelete(testJob._id);
      await Payment.deleteMany({ jobId: testJob._id });
      await AuditLog.deleteMany({ targetId: testJob._id });
    }
    await closeDB();
  });

  test('1. Existing events load successfully via GET /api/admin/job-requests', async () => {
    const res = await request(app)
      .get('/api/admin/job-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });

  test('2. Updating event details with recruiterPaymentStatus: PAID or REJECTED succeeds without enum error', async () => {
    // Create an approved job with recruiterPaymentStatus: 'PAID'
    testJob = await Job.create({
      recruiterId: recruiterUser._id,
      title: 'Grand Gala Night',
      description: 'Luxury wedding reception banquet management.',
      eventType: 'Wedding',
      eventDate: new Date(Date.now() + 86400000 * 5),
      startTime: '18:00',
      endTime: '23:30',
      location: {
        address: 'Palace Road, Jaipur, Rajasthan',
        latitude: 26.9124,
        longitude: 75.7873,
      },
      workersRequired: 5,
      recruiterProposedPayment: 1500,
      adminApprovedPayment: 1500,
      status: 'APPROVED',
      acceptedAt: new Date(),
      recruiterPaymentStatus: 'PAID',
    });

    // Update event via admin review endpoint
    const res = await request(app)
      .put(`/api/admin/jobs/${testJob._id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Grand Gala Night - Updated',
        workersRequired: 6,
        adminApprovedPayment: 1600,
        recruiterPaymentStatus: 'PAID',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.job.title).toBe('Grand Gala Night - Updated');
    expect(res.body.job.recruiterPaymentStatus).toBe('PAID');

    // Also test REJECTED status
    const res2 = await request(app)
      .put(`/api/admin/jobs/${testJob._id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        recruiterPaymentStatus: 'REJECTED',
      });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.job.recruiterPaymentStatus).toBe('REJECTED');

    // Restore to PAID for subsequent tests via API
    await request(app)
      .put(`/api/admin/jobs/${testJob._id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        recruiterPaymentStatus: 'PAID',
      });
  });

  test('3. Active -> Completed persists state, preserves payment statuses/amounts, and creates AuditLog', async () => {
    const res = await request(app)
      .post(`/api/admin/events/${testJob._id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adminNotes: 'All 5 workers completed catering shift on time.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.job.status).toBe('COMPLETED');
    expect(res.body.job.completedAt).toBeDefined();

    // Verify in database directly
    const updated = await Job.findById(testJob._id);
    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).toBeTruthy();
    expect(String(updated.completedByAdminId)).toBe(String(adminUser._id));
    // Recruiter payment status must remain unchanged
    expect(updated.recruiterPaymentStatus).toBe('PAID');
    expect(updated.adminApprovedPayment).toBe(1600);

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      entityId: testJob._id,
      action: 'COMPLETE_EVENT',
    });
    expect(audit).toBeTruthy();
    expect(String(audit.performedByUserId)).toBe(String(adminUser._id));
  });

  test('4. Idempotent complete call returns already completed message', async () => {
    const res = await request(app)
      .post(`/api/admin/events/${testJob._id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('already marked as completed');
  });

  test('5. Completed -> Reopen returns event to APPROVED, clears completedAt, preserves payment & audit history', async () => {
    const res = await request(app)
      .post(`/api/admin/events/${testJob._id}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        adminNotes: 'Reopening event for additional worker check-in verification.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.job.status).toBe('APPROVED');
    expect(res.body.job.completedAt).toBeNull();
    expect(res.body.job.completedByAdminId).toBeNull();

    // Verify in database
    const reopened = await Job.findById(testJob._id);
    expect(reopened.status).toBe('APPROVED');
    expect(reopened.completedAt).toBeNull();
    expect(reopened.completedByAdminId).toBeNull();
    // Payment status & amount must still be preserved
    expect(reopened.recruiterPaymentStatus).toBe('PAID');
    expect(reopened.adminApprovedPayment).toBe(1600);

    // Verify AuditLog for REOPEN_EVENT
    const reopenAudit = await AuditLog.findOne({
      entityId: testJob._id,
      action: 'REOPEN_EVENT',
    });
    expect(reopenAudit).toBeTruthy();
    expect(String(reopenAudit.performedByUserId)).toBe(String(adminUser._id));
  });

  test('6. Reopening an already active (non-completed) event is rejected with clear error', async () => {
    const res = await request(app)
      .post(`/api/admin/events/${testJob._id}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Only COMPLETED events can be reopened');
  });

  test('7. Unauthorized roles cannot complete or reopen events', async () => {
    const compRes = await request(app)
      .post(`/api/admin/events/${testJob._id}/complete`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send();
    expect(compRes.status).toBe(403);

    const reopenRes = await request(app)
      .post(`/api/admin/events/${testJob._id}/reopen`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send();
    expect(reopenRes.status).toBe(403);
  });
});
