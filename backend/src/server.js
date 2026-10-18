const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const AuditLog = require('./models/AuditLog');
const Attendance = require('./models/Attendance');
const Application = require('./models/Application');
const { seedDatabase } = require('./utils/seedData');
const { deleteSavedImage } = require('./utils/imageStorage');

const PORT = process.env.PORT || 5000;

// ── 30-Day Trash Cleanup ────────────────────────────────────────────────────
// Runs every 6 hours. Permanently deletes records that:
//   - are soft-deleted (isDeleted=true)
//   - have passed their permanentDeleteAt date
// Does NOT touch active records.
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function runTrashCleanup() {
  try {
    const now = new Date();
    
    // Cleanup Audit Logs
    // First, remove audit-specific historical images for any expired ACCOUNT_SELF_DELETED logs
    const expiredAuditLogs = await AuditLog.find({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
      action: 'ACCOUNT_SELF_DELETED',
    });
    for (const log of expiredAuditLogs) {
      if (log.previousValue?.profileImage && typeof log.previousValue.profileImage === 'string' && log.previousValue.profileImage.includes('/audit-')) {
        await deleteSavedImage(log.previousValue.profileImage);
      }
    }

    const auditResult = await AuditLog.deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (auditResult.deletedCount > 0) {
      console.log(`🗑️  Audit Trash Cleanup: permanently removed ${auditResult.deletedCount} expired record(s).`);
    }

    // Cleanup Attendance Records
    const expiredVerifiedAttendance = await Attendance.find({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
      status: 'PRESENT',
    });
    for (const expAtt of expiredVerifiedAttendance) {
      if (expAtt.assignmentId && expAtt.verifiedByAdminId) {
        await require('./models/Assignment').findByIdAndUpdate(expAtt.assignmentId, {
          verifiedByAdminId: expAtt.verifiedByAdminId,
        });
      }
    }

    const attendanceResult = await Attendance.deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (attendanceResult.deletedCount > 0) {
      console.log(`🗑️  Attendance Trash Cleanup: permanently removed ${attendanceResult.deletedCount} expired record(s).`);
    }

    // Cleanup Job Records
    const jobResult = await require('./models/Job').deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (jobResult.deletedCount > 0) {
      console.log(`🗑️  Job Trash Cleanup: permanently removed ${jobResult.deletedCount} expired record(s).`);
    }

    // Cleanup Application Records
    const applicationResult = await Application.deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (applicationResult.deletedCount > 0) {
      console.log(`🗑️  Application Trash Cleanup: permanently removed ${applicationResult.deletedCount} expired record(s).`);
    }

    // Cleanup Assignment Records
    const assignmentResult = await require('./models/Assignment').deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (assignmentResult.deletedCount > 0) {
      console.log(`🗑️  Assignment Trash Cleanup: permanently removed ${assignmentResult.deletedCount} expired record(s).`);
    }

    // Cleanup Payment Records (admin management records only — business outcome preserved on Assignment)
    const expiredPaidPayments = await require('./models/Payment').find({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
      status: 'PAID',
    });
    for (const expPay of expiredPaidPayments) {
      if (expPay.assignmentId) {
        await require('./models/Assignment').findByIdAndUpdate(expPay.assignmentId, {
          paymentSettlement: {
            status: 'PAID',
            amount: expPay.amount,
            paidAt: expPay.paidAt || expPay.updatedAt,
            transactionRef: expPay.transactionRef || '',
          },
        });
      }
    }

    const paymentResult = await require('./models/Payment').deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (paymentResult.deletedCount > 0) {
      console.log(`🗑️  Payment Trash Cleanup: permanently removed ${paymentResult.deletedCount} expired record(s).`);
    }

    // Cleanup Recruiter Collection / Payment Records
    const expiredRecruiterPayments = await require('./models/RecruiterPayment').find({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (expiredRecruiterPayments.length > 0) {
      const recJobIds = expiredRecruiterPayments.map((p) => p.jobId).filter(Boolean);
      if (recJobIds.length > 0) {
        await require('./models/Job').updateMany(
          { _id: { $in: recJobIds } },
          { $set: { recruiterCollectionPermanentlyDeleted: true } }
        );
      }
      const recPaymentResult = await require('./models/RecruiterPayment').deleteMany({
        isDeleted: true,
        permanentDeleteAt: { $lte: now },
      });
      if (recPaymentResult.deletedCount > 0) {
        console.log(`🗑️  Recruiter Payment Trash Cleanup: permanently removed ${recPaymentResult.deletedCount} expired record(s).`);
      }
    }

    const recCollectionResult = await require('./models/RecruiterCollection').deleteMany({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });
    if (recCollectionResult.deletedCount > 0) {
      console.log(`🗑️  Recruiter Collection Trash Cleanup: permanently removed ${recCollectionResult.deletedCount} expired record(s).`);
    }

  } catch (err) {
    console.error('Trash cleanup error:', err.message);
  }
}

const startServer = async () => {
  try {
    await connectDB();

    // Check if database needs initial seeding
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('No existing users found in DB. Auto-running initial seed data generator...');
      await seedDatabase();
    }

    // Start 30-day audit trash cleanup scheduler
    runTrashCleanup(); // run once on startup to catch any missed deletions
    setInterval(runTrashCleanup, CLEANUP_INTERVAL_MS);
    console.log('⏱️  Trash cleanup scheduler started (runs every 6 hours).');

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 JOBBYHOP Backend API Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

