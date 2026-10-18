/**
 * DB Audit Script — Read-only inspection of all collections.
 * Runs BEFORE any cleanup. No deletions in this script.
 */
require('dotenv').config();
const { connectDB, closeDB } = require('./src/config/db');

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

const audit = async () => {
  await connectDB();

  console.log('\n=== USERS ===');
  const users = await User.find({}, 'email role createdAt phone profileCompleted');
  users.forEach(u => console.log(`  [${u.role}] ${u.email}  (created: ${u.createdAt?.toISOString().slice(0,10)})`));

  console.log('\n=== RECRUITER PROFILES ===');
  const rProfiles = await RecruiterProfile.find({}, 'companyName userId');
  for (const p of rProfiles) {
    const u = await User.findById(p.userId, 'email');
    console.log(`  ${p.companyName} → user: ${u?.email}`);
  }

  console.log('\n=== WORKER PROFILES ===');
  const wProfiles = await WorkerProfile.find({}, 'fullName userId');
  for (const p of wProfiles) {
    const u = await User.findById(p.userId, 'email');
    console.log(`  ${p.fullName} → user: ${u?.email}`);
  }

  console.log('\n=== JOBS ===');
  const jobs = await Job.find({}, 'title status recruiterId createdAt');
  for (const j of jobs) {
    const rec = await User.findById(j.recruiterId, 'email');
    console.log(`  [${j.status}] "${j.title}" by ${rec?.email}  (created: ${j.createdAt?.toISOString().slice(0,10)})`);
  }

  console.log('\n=== APPLICATIONS ===');
  const apps = await Application.find({}, 'status jobId workerId');
  for (const a of apps) {
    const job = await Job.findById(a.jobId, 'title');
    const w = await User.findById(a.workerId, 'email');
    console.log(`  [${a.status}] Worker:${w?.email}  Job:"${job?.title}"`);
  }

  console.log('\n=== ASSIGNMENTS ===');
  const asgns = await Assignment.find({}, 'status jobId workerId');
  for (const a of asgns) {
    const job = await Job.findById(a.jobId, 'title');
    const w = await User.findById(a.workerId, 'email');
    console.log(`  [${a.status}] Worker:${w?.email}  Job:"${job?.title}"`);
  }

  console.log('\n=== ATTENDANCE ===');
  const att = await Attendance.find({}, 'status workerId jobId verifiedByAdminId');
  for (const a of att) {
    const w = await User.findById(a.workerId, 'email');
    const j = await Job.findById(a.jobId, 'title');
    console.log(`  [${a.status}] Worker:${w?.email}  Job:"${j?.title}"  locked:${!!a.verifiedByAdminId}`);
  }

  console.log('\n=== PAYMENTS ===');
  const pays = await Payment.find({}, 'status amount workerId jobId transactionRef');
  for (const p of pays) {
    const w = await User.findById(p.workerId, 'email');
    const j = await Job.findById(p.jobId, 'title');
    console.log(`  [${p.status}] ₹${p.amount} Worker:${w?.email}  Job:"${j?.title}"  UTR:${p.transactionRef || 'none'}`);
  }

  console.log('\n=== NOTIFICATIONS ===');
  const notifs = await Notification.find({}, 'type userId title createdAt');
  for (const n of notifs) {
    const u = await User.findById(n.userId, 'email');
    console.log(`  [${n.type}] "${n.title}" → user:${u?.email}  (${n.createdAt?.toISOString().slice(0,10)})`);
  }

  console.log('\n=== AUDIT LOGS ===');
  const logs = await AuditLog.find({}, 'action entityName performedByRole performedByUserId createdAt').sort({ createdAt: -1 }).limit(20);
  for (const l of logs) {
    const u = await User.findById(l.performedByUserId, 'email');
    console.log(`  [${l.performedByRole}] ${l.action} on ${l.entityName} by ${u?.email}  (${l.createdAt?.toISOString().slice(0,10)})`);
  }

  console.log('\n=== CANCELLATION REQUESTS ===');
  const cancels = await CancellationRequest.find({}, 'status requestedByUserId');
  for (const c of cancels) {
    const u = await User.findById(c.requestedByUserId, 'email');
    console.log(`  [${c.status}] by ${u?.email}`);
  }

  console.log('\n=== SUMMARY COUNTS ===');
  console.log('  Users (ADMIN):', await User.countDocuments({ role: 'ADMIN' }));
  console.log('  Users (OPERATIONS):', await User.countDocuments({ role: 'OPERATIONS' }));
  console.log('  Users (RECRUITER):', await User.countDocuments({ role: 'RECRUITER' }));
  console.log('  Users (WORKER):', await User.countDocuments({ role: 'WORKER' }));
  console.log('  Jobs:', await Job.countDocuments());
  console.log('  Applications:', await Application.countDocuments());
  console.log('  Assignments:', await Assignment.countDocuments());
  console.log('  Attendance:', await Attendance.countDocuments());
  console.log('  Payments:', await Payment.countDocuments());
  console.log('  Notifications:', await Notification.countDocuments());
  console.log('  AuditLogs:', await AuditLog.countDocuments());
  console.log('  CancellationRequests:', await CancellationRequest.countDocuments());

  await closeDB();
  process.exit(0);
};

audit().catch(err => { console.error(err); process.exit(1); });
