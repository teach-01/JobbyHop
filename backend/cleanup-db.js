/**
 * JOBBYHOP — COMPREHENSIVE ACTUAL DATABASE CLEANUP SCRIPT
 *
 * KEEPS:   supportjobbyhop@gmail.com (ADMIN)
 *          operations@jobbyhop.com  (OPERATIONS)
 *
 * DELETES: All Recruiter/Worker users, Jobs, Applications,
 *          Assignments, Attendance, Payments, RecruiterPayments,
 *          RecruiterCollections, Notifications, AuditLogs,
 *          CancellationRequests, OtpStores, PasswordResetTokens,
 *          and Recruiter/Worker profiles.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not set in .env'); process.exit(1); }

const { connectDB, closeDB } = require('./src/config/db');

const User                = require('./src/models/User');
const RecruiterProfile    = require('./src/models/RecruiterProfile');
const WorkerProfile       = require('./src/models/WorkerProfile');
const Job                 = require('./src/models/Job');
const Application         = require('./src/models/Application');
const Assignment          = require('./src/models/Assignment');
const Attendance          = require('./src/models/Attendance');
const Payment             = require('./src/models/Payment');
const RecruiterPayment    = require('./src/models/RecruiterPayment');
const RecruiterCollection = require('./src/models/RecruiterCollection');
const Notification        = require('./src/models/Notification');
const AuditLog            = require('./src/models/AuditLog');
const CancellationRequest = require('./src/models/CancellationRequest');
const OtpStore            = require('./src/models/OtpStore');
const PasswordResetToken  = require('./src/models/PasswordResetToken');

const section = (title) => console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);

const cleanup = async () => {
  await connectDB();

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  console.log(`\n✅ Connected to MongoDB Atlas`);
  console.log(`   Database : ${dbName}`);
  console.log(`   URI host : ${MONGODB_URI.match(/@([^/]+)/)?.[1] || 'unknown'}`);

  // ─── STEP 1: Lock in Protected Accounts ──────────────────────────
  section('STEP 1 — Identify protected accounts');

  const adminUser = await User.findOne({ role: 'ADMIN' });
  if (!adminUser) {
    console.error('❌ ABORT: No Admin user found. Stopping to prevent data loss.');
    await closeDB();
    process.exit(1);
  }
  console.log(`  🔒 ADMIN     : ${adminUser.email}  (_id: ${adminUser._id}, role: ${adminUser.role})`);

  const opsUser = await User.findOne({ role: 'OPERATIONS' });
  if (!opsUser) {
    console.error('❌ ABORT: operations@jobbyhop.com not found. Stopping to prevent data loss.');
    await closeDB();
    process.exit(1);
  }
  console.log(`  🔒 OPERATIONS: ${opsUser.email}  (_id: ${opsUser._id}, role: ${opsUser.role})`);

  const protectedIds = [adminUser._id, opsUser._id];

  // ─── STEP 2: BEFORE COUNTS ───────────────────────────────────────
  section('STEP 2 — BEFORE counts');

  const before = {
    adminUsers           : await User.countDocuments({ role: 'ADMIN' }),
    opsUsers             : await User.countDocuments({ role: 'OPERATIONS' }),
    recruiters           : await User.countDocuments({ role: 'RECRUITER' }),
    workers              : await User.countDocuments({ role: 'WORKER' }),
    recruiterProfiles    : await RecruiterProfile.countDocuments(),
    workerProfiles       : await WorkerProfile.countDocuments(),
    jobs                 : await Job.countDocuments(),
    applications         : await Application.countDocuments(),
    assignments          : await Assignment.countDocuments(),
    attendance           : await Attendance.countDocuments(),
    payments             : await Payment.countDocuments(),
    recruiterPayments    : await RecruiterPayment.countDocuments(),
    recruiterCollections : await RecruiterCollection.countDocuments(),
    notifications        : await Notification.countDocuments(),
    auditLogs            : await AuditLog.countDocuments(),
    cancellationRequests : await CancellationRequest.countDocuments(),
    otpStores            : await OtpStore.countDocuments(),
    passwordResetTokens  : await PasswordResetToken.countDocuments(),
  };

  Object.entries(before).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} : ${v}`));

  // Also check all collections in the DB
  const rawCollections = await db.listCollections().toArray();
  console.log(`\n  All MongoDB Collections (${rawCollections.length}):`);
  for (const c of rawCollections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`    - ${c.name.padEnd(24)}: ${count} documents`);
  }

  // ─── STEP 3: DELETIONS ───────────────────────────────────────────
  section('STEP 3 — Executing deletions');

  const deleted = {};
  let aborted = false;

  const safeDelete = async (label, fn) => {
    if (aborted) return;
    try {
      const result = await fn();
      deleted[label] = result.deletedCount ?? 0;
      console.log(`  ✅ Deleted ${deleted[label].toString().padStart(4)} ${label}`);
    } catch (err) {
      console.error(`  ❌ FAILED deleting ${label}: ${err.message}`);
      aborted = true;
    }
  };

  // Order matters: delete child / dependent collections first
  await safeDelete('AuditLogs',             () => AuditLog.deleteMany({}));
  await safeDelete('Notifications',          () => Notification.deleteMany({}));
  await safeDelete('CancellationRequests',   () => CancellationRequest.deleteMany({}));
  await safeDelete('Payments',               () => Payment.deleteMany({}));
  await safeDelete('RecruiterPayments',      () => RecruiterPayment.deleteMany({}));
  await safeDelete('RecruiterCollections',   () => RecruiterCollection.deleteMany({}));
  await safeDelete('Attendance',             () => Attendance.deleteMany({}));
  await safeDelete('Assignments',            () => Assignment.deleteMany({}));
  await safeDelete('Applications',           () => Application.deleteMany({}));
  await safeDelete('Jobs',                   () => Job.deleteMany({}));
  await safeDelete('RecruiterProfiles',      () => RecruiterProfile.deleteMany({}));
  await safeDelete('WorkerProfiles',         () => WorkerProfile.deleteMany({}));
  await safeDelete('OtpStores',              () => OtpStore.deleteMany({}));
  await safeDelete('PasswordResetTokens',   () => PasswordResetToken.deleteMany({}));
  // Delete non-admin, non-operations users
  await safeDelete('Recruiter & Worker users', () => User.deleteMany({ _id: { $nin: protectedIds } }));

  if (aborted) {
    console.error('\n❌ CLEANUP ABORTED due to error above. Database may be partially cleaned.');
    await closeDB();
    process.exit(1);
  }

  // ─── STEP 4: AFTER COUNTS ────────────────────────────────────────
  section('STEP 4 — AFTER counts (Verification)');

  const after = {
    adminUsers           : await User.countDocuments({ role: 'ADMIN' }),
    opsUsers             : await User.countDocuments({ role: 'OPERATIONS' }),
    recruiters           : await User.countDocuments({ role: 'RECRUITER' }),
    workers              : await User.countDocuments({ role: 'WORKER' }),
    recruiterProfiles    : await RecruiterProfile.countDocuments(),
    workerProfiles       : await WorkerProfile.countDocuments(),
    jobs                 : await Job.countDocuments(),
    applications         : await Application.countDocuments(),
    assignments          : await Assignment.countDocuments(),
    attendance           : await Attendance.countDocuments(),
    payments             : await Payment.countDocuments(),
    recruiterPayments    : await RecruiterPayment.countDocuments(),
    recruiterCollections : await RecruiterCollection.countDocuments(),
    notifications        : await Notification.countDocuments(),
    auditLogs            : await AuditLog.countDocuments(),
    cancellationRequests : await CancellationRequest.countDocuments(),
    otpStores            : await OtpStore.countDocuments(),
    passwordResetTokens  : await PasswordResetToken.countDocuments(),
  };

  const expected = {
    adminUsers           : 1,
    opsUsers             : 1,
    recruiters           : 0,
    workers              : 0,
    recruiterProfiles    : 0,
    workerProfiles       : 0,
    jobs                 : 0,
    applications         : 0,
    assignments          : 0,
    attendance           : 0,
    payments             : 0,
    recruiterPayments    : 0,
    recruiterCollections : 0,
    notifications        : 0,
    auditLogs            : 0,
    cancellationRequests : 0,
    otpStores            : 0,
    passwordResetTokens  : 0,
  };

  let allPass = true;
  Object.entries(after).forEach(([k, v]) => {
    const exp = expected[k];
    const pass = v === exp;
    if (!pass) allPass = false;
    console.log(`  ${pass ? '✅' : '❌'} ${k.padEnd(22)} : ${v}  (expected ${exp})`);
  });

  // ─── STEP 5: Account Existence & Integrity ───────────────────────
  section('STEP 5 — Protected Account Integrity Check');

  const adminCheck = await User.findOne({ role: 'ADMIN' });
  const opsCheck   = await User.findOne({ role: 'OPERATIONS' });
  const opsDupCheck = await User.countDocuments({ role: 'OPERATIONS' });
  const adminDupCheck = await User.countDocuments({ role: 'ADMIN' });
  const totalUserCheck = await User.countDocuments();

  console.log(`  ${adminCheck ? '✅' : '❌'} Admin exists         : ${adminCheck?.email} (_id: ${adminCheck?._id})`);
  console.log(`  ${adminDupCheck === 1 ? '✅' : '❌'} Exactly 1 ADMIN account  (count = ${adminDupCheck})`);
  console.log(`  ${opsCheck ? '✅' : '❌'} Operations exists    : ${opsCheck?.email} (_id: ${opsCheck?._id})`);
  console.log(`  ${opsDupCheck === 1 ? '✅' : '❌'} Exactly 1 OPERATIONS account (count = ${opsDupCheck})`);
  console.log(`  ${totalUserCheck === 2 ? '✅' : '❌'} Total Users in DB is exactly 2 (count = ${totalUserCheck})`);

  // ─── STEP 6: Summary Table ───────────────────────────────────────
  section('STEP 6 — BEFORE → DELETED → AFTER Summary');

  console.log('\n  COLLECTION / ITEM         BEFORE → DELETED → AFTER\n');
  Object.keys(before).forEach(k => {
    const b = before[k], a = after[k];
    const d = b - a;
    console.log(`  ${k.padEnd(25)} : ${b.toString().padStart(4)} → -${d.toString().padStart(3)} → ${a.toString().padStart(4)}`);
  });

  // Verify all collections in DB one final time
  console.log(`\n  Final MongoDB Collection Status:`);
  for (const c of rawCollections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`    - ${c.name.padEnd(24)}: ${count} documents`);
  }

  console.log(`\n  Overall Result: ${allPass && totalUserCheck === 2 ? '✅ ALL CLEANUP CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

  await closeDB();
  process.exit(allPass && totalUserCheck === 2 ? 0 : 1);
};

cleanup().catch(err => {
  console.error('❌ Fatal error during cleanup:', err);
  process.exit(1);
});
