const request = require('supertest');
const app = require('../app');
const { connectDB, closeDB } = require('../config/db');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const RecruiterPayment = require('../models/RecruiterPayment');
const WorkerProfile = require('../models/WorkerProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const bcrypt = require('bcryptjs');

describe('JobbyHop — Admin Trash Isolation & Worker/Recruiter Profile Protection', () => {
  let adminToken;
  let workerToken;
  let recruiterToken;
  let workerUser;
  let recruiterUser;
  let approvedJob;
  let pendingJob;
  let approvedApp;
  let pendingApp;
  let assignment;
  let attendance;
  let workerPayment;
  let recruiterPayment;

  beforeAll(async () => {
    await connectDB();

    // 1. Setup Admin
    const adminEmail = `admin_trash_test_${Date.now()}@jobbyhop.com`;
    const passwordHash = await bcrypt.hash('pass123', 10);
    const admin = await User.create({
      email: adminEmail,
      passwordHash,
      phone: `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role: 'ADMIN',
      status: 'ACTIVE',
      profileCompleted: true,
    });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'pass123' });
    adminToken = adminLogin.body.token;

    // 2. Setup Recruiter
    const recEmail = `rec_trash_test_${Date.now()}@jobbyhop.com`;
    recruiterUser = await User.create({
      email: recEmail,
      passwordHash,
      phone: `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role: 'RECRUITER',
      status: 'ACTIVE',
      profileCompleted: true,
    });
    await RecruiterProfile.create({
      userId: recruiterUser._id,
      fullName: 'Apex Admin',
      companyName: 'Apex Events Corp',
      location: 'Mumbai',
      phone: recruiterUser.phone,
      email: recruiterUser.email,
    });
    const recLogin = await request(app).post('/api/auth/login').send({ email: recEmail, password: 'pass123' });
    recruiterToken = recLogin.body.token;

    // 3. Setup Worker
    const workerEmail = `worker_trash_test_${Date.now()}@jobbyhop.com`;
    workerUser = await User.create({
      email: workerEmail,
      passwordHash,
      phone: `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role: 'WORKER',
      status: 'ACTIVE',
      profileCompleted: true,
    });
    await WorkerProfile.create({
      userId: workerUser._id,
      fullName: 'Rahul Sharma',
      profilePhoto: '/uploads/rahul.jpg',
      location: 'Mumbai',
      dob: new Date('1998-05-15'),
      phone: workerUser.phone,
      email: workerUser.email,
    });
    const workerLogin = await request(app).post('/api/auth/login').send({ email: workerEmail, password: 'pass123' });
    workerToken = workerLogin.body.token;

    // 4. Create two jobs for Recruiter: Job 1 (Approved) and Job 2 (for Pending application)
    approvedJob = await Job.create({
      recruiterId: recruiterUser._id,
      title: 'Grand Tech Expo 2026',
      description: 'Annual corporate technology symposium',
      eventType: 'Exhibition',
      eventDate: new Date(Date.now() + 86400000),
      startTime: '09:00',
      endTime: '18:00',
      location: 'Bandra Kurla Complex, Mumbai',
      workersRequired: 5,
      recruiterProposedPayment: 1500,
      adminApprovedPayment: 600,
      status: 'APPROVED',
      acceptedAt: new Date(),
    });

    pendingJob = await Job.create({
      recruiterId: recruiterUser._id,
      title: 'City Marathon 2026',
      description: 'Annual marathon checkpoint coordinator',
      eventType: 'Corporate Function',
      eventDate: new Date(Date.now() + 172800000),
      startTime: '06:00',
      endTime: '12:00',
      location: 'Marine Drive, Mumbai',
      workersRequired: 10,
      recruiterProposedPayment: 1200,
      adminApprovedPayment: 500,
      status: 'APPROVED',
      acceptedAt: new Date(),
    });

    // 5. Worker creates two applications: One APPROVED, One PENDING (APPLIED)
    approvedApp = await Application.create({
      jobId: approvedJob._id,
      workerId: workerUser._id,
      status: 'APPROVED',
      reviewedByAdminId: admin._id,
      reviewedAt: new Date(),
    });

    pendingApp = await Application.create({
      jobId: pendingJob._id,
      workerId: workerUser._id,
      status: 'APPLIED',
    });

    // 6. Assignment for approved application
    assignment = await Assignment.create({
      jobId: approvedJob._id,
      workerId: workerUser._id,
      applicationId: approvedApp._id,
      status: 'COMPLETED',
      assignedByAdminId: admin._id,
      verifiedByAdminId: admin._id,
      paymentSettlement: {
        status: 'PAID',
        amount: 600,
        paidAt: new Date(),
        transactionRef: 'UTR-REG-TEST-123',
      },
    });

    // 7. Attendance marked PRESENT and Admin-verified
    attendance = await Attendance.create({
      assignmentId: assignment._id,
      jobId: approvedJob._id,
      workerId: workerUser._id,
      date: approvedJob.eventDate,
      status: 'PRESENT',
      verifiedByAdminId: admin._id,
      checkInTime: '08:55',
      checkOutTime: '18:05',
    });

    // 8. Worker payment record (PAID)
    workerPayment = await Payment.create({
      workerId: workerUser._id,
      jobId: approvedJob._id,
      assignmentId: assignment._id,
      amount: 600,
      status: 'PAID',
      expectedPaymentDate: new Date(),
      paidAt: new Date(),
      transactionRef: 'UTR-REG-TEST-123',
    });

    // 9. Recruiter payment record (PAID)
    recruiterPayment = await RecruiterPayment.create({
      recruiterId: recruiterUser._id,
      jobId: approvedJob._id,
      amount: 3000,
      status: 'PAID',
      utr: 'REC-UTR-999',
      paymentMethod: 'UPI',
    });
  });

  afterAll(async () => {
    await closeDB();
  });

  // Step 1 & 2: Verify Worker profile and application history show both records
  test('1 & 2. Worker profile and application history show both records (1 APPROVED, 1 PENDING)', async () => {
    const res = await request(app)
      .get('/api/worker/applications')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const apps = res.body.applications;
    expect(apps.length).toBe(2);

    const appStatuses = apps.map((a) => a.status);
    expect(appStatuses).toContain('APPROVED');
    expect(appStatuses).toContain('APPLIED');
  });

  // Step 3: Verify associated Recruiter profile and event history
  test('3. Recruiter profile and event history show their jobs and payments', async () => {
    const jobsRes = await request(app)
      .get('/api/recruiter/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(jobsRes.status).toBe(200);
    expect(jobsRes.body.success).toBe(true);
    expect(jobsRes.body.jobs.length).toBeGreaterThanOrEqual(2);

    const payRes = await request(app)
      .get('/api/recruiter-payments/my-payments')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(payRes.status).toBe(200);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.payments.length).toBeGreaterThanOrEqual(1);
  });

  // Step 4: Move relevant Admin-side record to Trash
  test('4. Admin moves an application to Trash', async () => {
    const res = await request(app)
      .delete(`/api/admin/applications/${approvedApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Admin active applications excludes it
    const adminAppsRes = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${adminToken}`);
    const activeAppIds = adminAppsRes.body.applications.map((a) => a._id.toString());
    expect(activeAppIds).not.toContain(approvedApp._id.toString());

    // Verify Admin Trash applications includes it
    const trashRes = await request(app)
      .get('/api/admin/applications/trash')
      .set('Authorization', `Bearer ${adminToken}`);
    const trashAppIds = trashRes.body.applications.map((a) => a._id.toString());
    expect(trashAppIds).toContain(approvedApp._id.toString());
  });

  // Step 5: Recheck both profiles and verify unrelated original records remain unchanged
  test('5. Recheck profiles: Worker still sees both applications; Recruiter jobs remain unchanged', async () => {
    // Worker view
    const workerAppsRes = await request(app)
      .get('/api/worker/applications')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(workerAppsRes.status).toBe(200);
    const apps = workerAppsRes.body.applications;
    expect(apps.length).toBe(2);

    // Recruiter view
    const recJobsRes = await request(app)
      .get('/api/recruiter/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(recJobsRes.status).toBe(200);
    expect(recJobsRes.body.jobs.length).toBeGreaterThanOrEqual(2);
  });

  // Step 6: Verify attendance marked PRESENT and Admin-verified remains intact
  test('6. Verify attendance marked PRESENT and Admin-verified remains intact when Admin trashes attendance item', async () => {
    // Admin soft-deletes attendance item to trash
    const trashAttRes = await request(app)
      .delete(`/api/admin/attendance/${attendance._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(trashAttRes.status).toBe(200);

    // Admin active attendance list excludes it
    const adminAttRes = await request(app)
      .get('/api/admin/attendance')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminAttIds = adminAttRes.body.attendance.map((a) => a._id.toString());
    expect(adminAttIds).not.toContain(attendance._id.toString());

    // Worker profile MUST still retain their attendance record and PRESENT status!
    const workerAttRes = await request(app)
      .get('/api/worker/attendance')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(workerAttRes.status).toBe(200);
    expect(workerAttRes.body.attendance.length).toBeGreaterThanOrEqual(1);
    const workerAttRecord = workerAttRes.body.attendance.find(
      (a) => a.jobId?._id?.toString() === approvedJob._id.toString() || a.jobId?.toString() === approvedJob._id.toString()
    );
    expect(workerAttRecord).toBeDefined();
    expect(workerAttRecord.status).toBe('PRESENT');
  });

  // Step 7: Verify event completion and worker/recruiter payment histories remain consistent
  test('7. Verify worker & recruiter payment histories remain consistent even after Admin moves payment to Trash', async () => {
    // Admin soft-deletes worker payment
    const delPayRes = await request(app)
      .delete(`/api/admin/payments/${workerPayment._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delPayRes.status).toBe(200);

    // Admin soft-deletes recruiter collection payment
    const delRecPayRes = await request(app)
      .delete(`/api/recruiter-payments/${recruiterPayment._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRecPayRes.status).toBe(200);

    // Worker still sees PAID payment of ₹600
    const workerPayRes = await request(app)
      .get('/api/worker/payments')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(workerPayRes.status).toBe(200);
    expect(workerPayRes.body.summary.totalEarned).toBeGreaterThanOrEqual(600);
    const workerPaidItem = workerPayRes.body.payments.find((p) => p.status === 'PAID');
    expect(workerPaidItem).toBeDefined();
    expect(workerPaidItem.amount).toBe(600);

    // Recruiter still sees PAID payment of ₹3000
    const recPayRes = await request(app)
      .get('/api/recruiter-payments/my-payments')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(recPayRes.status).toBe(200);
    const recPaidItem = recPayRes.body.payments.find((p) => p.status === 'PAID');
    expect(recPaidItem).toBeDefined();
    expect(recPaidItem.amount).toBe(3000);
  });

  // Step 8: Test Restore and verify that the Admin list returns to the correct state
  test('8. Test Restore: Admin restores application and attendance from Trash', async () => {
    // Restore application
    const restAppRes = await request(app)
      .patch(`/api/admin/applications/${approvedApp._id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restAppRes.status).toBe(200);

    // Restore attendance
    const restAttRes = await request(app)
      .patch(`/api/admin/attendance/${attendance._id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restAttRes.status).toBe(200);

    // Verify Admin active lists now include them again
    const adminAppsRes = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAppsRes.body.applications.map((a) => a._id.toString())).toContain(approvedApp._id.toString());

    const adminAttRes = await request(app)
      .get('/api/admin/attendance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAttRes.body.attendance.map((a) => a._id.toString())).toContain(attendance._id.toString());
  });

  // Step 9: Test permanent deletion separately, ensuring it affects only records explicitly intended
  test('9. Permanent deletion affects only records explicitly intended for permanent deletion', async () => {
    // Soft-delete pending application first
    await request(app)
      .delete(`/api/admin/applications/${pendingApp._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Permanently delete pending application from Trash
    const permRes = await request(app)
      .delete(`/api/admin/applications/${pendingApp._id}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(permRes.status).toBe(200);

    // Verify pending application is gone from DB
    const checkPending = await Application.findById(pendingApp._id);
    expect(checkPending).toBeNull();

    // Verify approved application, assignment, attendance, and payments remain intact!
    const checkApproved = await Application.findById(approvedApp._id);
    expect(checkApproved).not.toBeNull();
    const checkAssign = await Assignment.findById(assignment._id);
    expect(checkAssign).not.toBeNull();
    const checkAtt = await Attendance.findById(attendance._id);
    expect(checkAtt).not.toBeNull();
    const checkPay = await Payment.findById(workerPayment._id);
    expect(checkPay).not.toBeNull();
  });

  // Step 10: Confirm no duplicate applications, events, attendance records, or payment entries are created
  test('10. Confirm no duplicate records created during synchronization or restoration', async () => {
    const appCount = await Application.countDocuments({ jobId: approvedJob._id, workerId: workerUser._id });
    expect(appCount).toBe(1);

    const asgCount = await Assignment.countDocuments({ jobId: approvedJob._id, workerId: workerUser._id });
    expect(asgCount).toBe(1);

    const attCount = await Attendance.countDocuments({ jobId: approvedJob._id, workerId: workerUser._id });
    expect(attCount).toBe(1);

    const payCount = await Payment.countDocuments({ jobId: approvedJob._id, workerId: workerUser._id });
    expect(payCount).toBe(1);
  });
});
