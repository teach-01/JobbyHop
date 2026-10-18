/**
 * JOBBYHOP — Database Cleanup Script
 * Removes all mock/seed/test data while preserving Admin + real users.
 *
 * SAFE: Does NOT use deleteMany({}) on any collection without targeted IDs.
 * Targets specific mock user IDs and their related records.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const RecruiterProfile = require('./src/models/RecruiterProfile');
const WorkerProfile = require('./src/models/WorkerProfile');
const Job = require('./src/models/Job');
const Application = require('./src/models/Application');
const Assignment = require('./src/models/Assignment');
const Attendance = require('./src/models/Attendance');
const Payment = require('./src/models/Payment');
const Notification = require('./src/models/Notification');
const AuditLog = require('./src/models/AuditLog');
const CancellationRequest = require('./src/models/CancellationRequest');

// ── Exact mock/seed/test emails to remove ──
const MOCK_EMAILS = [
  // Seeded by seedDatabase()
  'recruiter1@eventco.com',
  'recruiter2@grandweddings.com',
  'worker1@jobbyhop.com',
  'worker2@jobbyhop.com',
  'worker3@jobbyhop.com',
  'worker4@jobbyhop.com',
  'worker5@jobbyhop.com',
  // Created by automated verification scripts
  'newworker_1790853118097@jobbyhop.com',
  'freshworker_1790853886768@jobbyhop.com',
  'freshrecruiter_1790853886768@jobbyhop.com',
  'freshworker_1790853928240@jobbyhop.com',
  'freshrecruiter_1790853928240@jobbyhop.com',
  'freshworker_1790853959698@jobbyhop.com',
  'freshrecruiter_1790853959698@jobbyhop.com',
];

// REAL users — NEVER delete these
const PROTECTED_EMAILS = [
  'supportjobbyhop@gmail.com',
  'aadishbwm0@gmail.com',
  'aadishjainbwm1@gmail.com',
];

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // ── 1. Identify mock user IDs ──
  const mockUsers = await User.find({ email: { $in: MOCK_EMAILS } }).select('_id email role');
  const mockUserIds = mockUsers.map(u => u._id);
  console.log(`Found ${mockUsers.length} mock/test users to delete:`);
  mockUsers.forEach(u => console.log(`  • ${u.email} (${u.role}) [${u._id}]`));

  // Safety check: make sure no protected email is in the list
  const protectedInMock = mockUsers.filter(u => PROTECTED_EMAILS.includes(u.email));
  if (protectedInMock.length > 0) {
    console.error('\n❌ ABORT: Protected email found in mock list!', protectedInMock.map(u => u.email));
    process.exit(1);
  }

  if (mockUserIds.length === 0) {
    console.log('\n✅ No mock users found. Database is already clean.');
    await printCounts();
    await mongoose.disconnect();
    return;
  }

  // ── 2. Find all mock jobs (created by mock recruiters) ──
  const mockRecruiterIds = mockUsers.filter(u => u.role === 'RECRUITER').map(u => u._id);
  const mockJobs = await Job.find({ recruiterId: { $in: mockRecruiterIds } }).select('_id title');
  const mockJobIds = mockJobs.map(j => j._id);
  console.log(`\nFound ${mockJobs.length} mock jobs to delete:`);
  mockJobs.forEach(j => console.log(`  • ${j.title} [${j._id}]`));

  // ── 3. Delete related records (in dependency order) ──

  // Payments linked to mock jobs or mock workers
  const paymentDel = await Payment.deleteMany({
    $or: [
      { jobId: { $in: mockJobIds } },
      { workerId: { $in: mockUserIds } },
    ],
  });
  console.log(`\nDeleted ${paymentDel.deletedCount} mock payments`);

  // Attendance linked to mock jobs or mock workers
  const attendanceDel = await Attendance.deleteMany({
    $or: [
      { jobId: { $in: mockJobIds } },
      { workerId: { $in: mockUserIds } },
    ],
  });
  console.log(`Deleted ${attendanceDel.deletedCount} mock attendance records`);

  // Cancellation requests linked to mock users/jobs
  const cancelDel = await CancellationRequest.deleteMany({
    $or: [
      { jobId: { $in: mockJobIds } },
      { requestedByUserId: { $in: mockUserIds } },
    ],
  });
  console.log(`Deleted ${cancelDel.deletedCount} mock cancellation requests`);

  // Assignments linked to mock jobs or mock workers
  const assignDel = await Assignment.deleteMany({
    $or: [
      { jobId: { $in: mockJobIds } },
      { workerId: { $in: mockUserIds } },
    ],
  });
  console.log(`Deleted ${assignDel.deletedCount} mock assignments`);

  // Applications linked to mock jobs or mock workers
  const appDel = await Application.deleteMany({
    $or: [
      { jobId: { $in: mockJobIds } },
      { workerId: { $in: mockUserIds } },
    ],
  });
  console.log(`Deleted ${appDel.deletedCount} mock applications`);

  // Notifications for mock users
  const notifDel = await Notification.deleteMany({
    userId: { $in: mockUserIds },
  });
  console.log(`Deleted ${notifDel.deletedCount} mock notifications`);

  // Audit logs referencing mock users or mock entities
  const auditDel = await AuditLog.deleteMany({
    $or: [
      { performedByUserId: { $in: mockUserIds } },
      { entityId: { $in: [...mockUserIds, ...mockJobIds] } },
    ],
  });
  console.log(`Deleted ${auditDel.deletedCount} mock audit logs`);

  // Jobs by mock recruiters
  const jobDel = await Job.deleteMany({ _id: { $in: mockJobIds } });
  console.log(`Deleted ${jobDel.deletedCount} mock jobs`);

  // Profiles for mock users
  const recProfileDel = await RecruiterProfile.deleteMany({ userId: { $in: mockUserIds } });
  console.log(`Deleted ${recProfileDel.deletedCount} mock recruiter profiles`);

  const workerProfileDel = await WorkerProfile.deleteMany({ userId: { $in: mockUserIds } });
  console.log(`Deleted ${workerProfileDel.deletedCount} mock worker profiles`);

  // Finally, delete mock user documents
  const userDel = await User.deleteMany({ _id: { $in: mockUserIds } });
  console.log(`Deleted ${userDel.deletedCount} mock user accounts`);

  // ── 4. Verify Admin is still present ──
  const admin = await User.findOne({ role: 'ADMIN' });
  if (admin) {
    console.log(`\n✅ Admin account preserved: ${admin.email} (status: ${admin.status})`);
  } else {
    console.error('\n❌ CRITICAL: Admin account NOT found after cleanup!');
  }

  // ── 5. Print final counts ──
  await printCounts();

  await mongoose.disconnect();
  console.log('\n✅ Database cleanup completed successfully.');
}

async function printCounts() {
  console.log('\n===== FINAL DATABASE COUNTS =====');
  const adminCount = await User.countDocuments({ role: 'ADMIN' });
  const recruiterCount = await User.countDocuments({ role: 'RECRUITER' });
  const workerCount = await User.countDocuments({ role: 'WORKER' });
  const jobCount = await Job.countDocuments({});
  const appCount = await Application.countDocuments({});
  const assignCount = await Assignment.countDocuments({});
  const attendCount = await Attendance.countDocuments({});
  const paymentCount = await Payment.countDocuments({});
  const notifCount = await Notification.countDocuments({});
  const auditCount = await AuditLog.countDocuments({});
  const cancelCount = await CancellationRequest.countDocuments({});

  console.log(`  Users:          Admin=${adminCount}, Recruiter=${recruiterCount}, Worker=${workerCount}`);
  console.log(`  Jobs:           ${jobCount}`);
  console.log(`  Applications:   ${appCount}`);
  console.log(`  Assignments:    ${assignCount}`);
  console.log(`  Attendance:     ${attendCount}`);
  console.log(`  Payments:       ${paymentCount}`);
  console.log(`  Notifications:  ${notifCount}`);
  console.log(`  AuditLogs:      ${auditCount}`);
  console.log(`  Cancellations:  ${cancelCount}`);

  // List remaining users
  const remaining = await User.find({}).select('email role status isDeleted');
  console.log('\n  Remaining Users:');
  remaining.forEach(u => console.log(`    • ${u.email} (${u.role}) status=${u.status} deleted=${u.isDeleted || false}`));
}

cleanup().catch(e => { console.error('Cleanup error:', e); process.exit(1); });
