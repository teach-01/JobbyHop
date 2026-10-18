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
const CancellationRequest = require('./src/models/CancellationRequest');
const AuditLog = require('./src/models/AuditLog');
const OtpStore = require('./src/models/OtpStore'); // just in case

async function runCleanup() {
  try {
    console.log('Connecting to database:', process.env.MONGODB_URI.split('@')[1] || process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.db.databaseName);

    // 1. Get BEFORE counts
    console.log('\n--- BEFORE COUNTS ---');
    const bUsers = await User.countDocuments();
    const bRecruiterProfiles = await RecruiterProfile.countDocuments();
    const bWorkerProfiles = await WorkerProfile.countDocuments();
    const bJobs = await Job.countDocuments();
    const bApplications = await Application.countDocuments();
    const bAssignments = await Assignment.countDocuments();
    const bAttendance = await Attendance.countDocuments();
    const bPayments = await Payment.countDocuments();
    const bNotifications = await Notification.countDocuments();
    const bCancellationRequests = await CancellationRequest.countDocuments();
    const bAuditLogs = await AuditLog.countDocuments();
    const bOtpStores = await OtpStore.countDocuments();

    console.log(`Users: ${bUsers}`);
    console.log(`RecruiterProfiles: ${bRecruiterProfiles}`);
    console.log(`WorkerProfiles: ${bWorkerProfiles}`);
    console.log(`Jobs: ${bJobs}`);
    console.log(`Applications: ${bApplications}`);
    console.log(`Assignments: ${bAssignments}`);
    console.log(`Attendance: ${bAttendance}`);
    console.log(`Payments: ${bPayments}`);
    console.log(`Notifications: ${bNotifications}`);
    console.log(`CancellationRequests: ${bCancellationRequests}`);
    console.log(`AuditLogs: ${bAuditLogs}`);
    console.log(`OtpStore: ${bOtpStores}`);

    // 2. Perform deletions
    console.log('\n--- DELETING ---');
    const adminEmails = ['supportjobbyhop@gmail.com', 'operations@jobbyhop.com'];
    
    // Delete non-admin users
    const delUsers = await User.deleteMany({ email: { $nin: adminEmails } });
    console.log(`Deleted Users: ${delUsers.deletedCount}`);

    const delRecruiterProfiles = await RecruiterProfile.deleteMany({});
    console.log(`Deleted RecruiterProfiles: ${delRecruiterProfiles.deletedCount}`);

    const delWorkerProfiles = await WorkerProfile.deleteMany({});
    console.log(`Deleted WorkerProfiles: ${delWorkerProfiles.deletedCount}`);

    const delJobs = await Job.deleteMany({});
    console.log(`Deleted Jobs: ${delJobs.deletedCount}`);

    const delApplications = await Application.deleteMany({});
    console.log(`Deleted Applications: ${delApplications.deletedCount}`);

    const delAssignments = await Assignment.deleteMany({});
    console.log(`Deleted Assignments: ${delAssignments.deletedCount}`);

    const delAttendance = await Attendance.deleteMany({});
    console.log(`Deleted Attendance: ${delAttendance.deletedCount}`);

    const delPayments = await Payment.deleteMany({});
    console.log(`Deleted Payments: ${delPayments.deletedCount}`);

    const delNotifications = await Notification.deleteMany({});
    console.log(`Deleted Notifications: ${delNotifications.deletedCount}`);

    const delCancellationRequests = await CancellationRequest.deleteMany({});
    console.log(`Deleted CancellationRequests: ${delCancellationRequests.deletedCount}`);

    const delAuditLogs = await AuditLog.deleteMany({});
    console.log(`Deleted AuditLogs: ${delAuditLogs.deletedCount}`);

    const delOtpStores = await OtpStore.deleteMany({});
    console.log(`Deleted OtpStore: ${delOtpStores.deletedCount}`);

    // 3. Get AFTER counts
    console.log('\n--- AFTER COUNTS ---');
    const aUsers = await User.countDocuments();
    const aRecruiterProfiles = await RecruiterProfile.countDocuments();
    const aWorkerProfiles = await WorkerProfile.countDocuments();
    const aJobs = await Job.countDocuments();
    const aApplications = await Application.countDocuments();
    const aAssignments = await Assignment.countDocuments();
    const aAttendance = await Attendance.countDocuments();
    const aPayments = await Payment.countDocuments();
    const aNotifications = await Notification.countDocuments();
    const aCancellationRequests = await CancellationRequest.countDocuments();
    const aAuditLogs = await AuditLog.countDocuments();
    const aOtpStores = await OtpStore.countDocuments();

    console.log(`Users: ${aUsers}`);
    console.log(`RecruiterProfiles: ${aRecruiterProfiles}`);
    console.log(`WorkerProfiles: ${aWorkerProfiles}`);
    console.log(`Jobs: ${aJobs}`);
    console.log(`Applications: ${aApplications}`);
    console.log(`Assignments: ${aAssignments}`);
    console.log(`Attendance: ${aAttendance}`);
    console.log(`Payments: ${aPayments}`);
    console.log(`Notifications: ${aNotifications}`);
    console.log(`CancellationRequests: ${aCancellationRequests}`);
    console.log(`AuditLogs: ${aAuditLogs}`);
    console.log(`OtpStore: ${aOtpStores}`);

    // 4. Verify Admins
    console.log('\n--- VERIFY ADMINS ---');
    const admins = await User.find({ email: { $in: adminEmails } });
    admins.forEach(u => {
        console.log(`Found: ${u.email} - Role: ${u.role}`);
    });
    
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    const opsCount = await User.countDocuments({ role: 'OPERATIONS' });
    const recruiterCount = await User.countDocuments({ role: 'RECRUITER' });
    const workerCount = await User.countDocuments({ role: 'WORKER' });
    
    console.log(`ADMIN count = ${adminCount}`);
    console.log(`OPERATIONS count = ${opsCount}`);
    console.log(`RECRUITER count = ${recruiterCount}`);
    console.log(`WORKER count = ${workerCount}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

runCleanup();
