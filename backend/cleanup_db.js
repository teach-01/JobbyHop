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
const OTP = require('./src/models/OtpStore');

async function cleanup() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI not found in .env');
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ Connected to database: ${mongoose.connection.name}`);
    console.log('====================================');

    // Counts BEFORE
    console.log('COUNTS BEFORE DELETION:');
    const beforeCounts = {
      Users: await User.countDocuments(),
      RecruiterProfiles: await RecruiterProfile.countDocuments(),
      WorkerProfiles: await WorkerProfile.countDocuments(),
      Jobs: await Job.countDocuments(),
      Applications: await Application.countDocuments(),
      Assignments: await Assignment.countDocuments(),
      Attendance: await Attendance.countDocuments(),
      Payments: await Payment.countDocuments(),
      Notifications: await Notification.countDocuments(),
      CancellationRequests: await CancellationRequest.countDocuments(),
      AuditLogs: await AuditLog.countDocuments(),
      OTPs: await OTP.countDocuments(),
    };
    console.table(beforeCounts);

    console.log('====================================');
    console.log('STARTING CLEANUP...');
    
    // Delete non-admin, non-operations users
    const deleteUsersResult = await User.deleteMany({
      email: { $nin: ['supportjobbyhop@gmail.com', 'operations@jobbyhop.com'] }
    });
    console.log(`Deleted ${deleteUsersResult.deletedCount} Users (kept Admin & Operations)`);

    const deletedCounts = {
      RecruiterProfiles: (await RecruiterProfile.deleteMany({})).deletedCount,
      WorkerProfiles: (await WorkerProfile.deleteMany({})).deletedCount,
      Jobs: (await Job.deleteMany({})).deletedCount,
      Applications: (await Application.deleteMany({})).deletedCount,
      Assignments: (await Assignment.deleteMany({})).deletedCount,
      Attendance: (await Attendance.deleteMany({})).deletedCount,
      Payments: (await Payment.deleteMany({})).deletedCount,
      Notifications: (await Notification.deleteMany({})).deletedCount,
      CancellationRequests: (await CancellationRequest.deleteMany({})).deletedCount,
      AuditLogs: (await AuditLog.deleteMany({})).deletedCount,
      OTPs: (await OTP.deleteMany({})).deletedCount,
    };
    
    console.table(deletedCounts);

    console.log('====================================');
    console.log('COUNTS AFTER DELETION:');
    const afterCounts = {
      Users: await User.countDocuments(),
      RecruiterProfiles: await RecruiterProfile.countDocuments(),
      WorkerProfiles: await WorkerProfile.countDocuments(),
      Jobs: await Job.countDocuments(),
      Applications: await Application.countDocuments(),
      Assignments: await Assignment.countDocuments(),
      Attendance: await Attendance.countDocuments(),
      Payments: await Payment.countDocuments(),
      Notifications: await Notification.countDocuments(),
      CancellationRequests: await CancellationRequest.countDocuments(),
      AuditLogs: await AuditLog.countDocuments(),
      OTPs: await OTP.countDocuments(),
    };
    console.table(afterCounts);

    console.log('====================================');
    console.log('VERIFYING REMAINING USERS:');
    const remainingUsers = await User.find({}, 'email role');
    console.table(remainingUsers.map(u => ({ email: u.email, role: u.role })));

    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

cleanup();
