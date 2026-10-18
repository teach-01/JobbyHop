const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('./src/models/Payment');
const Attendance = require('./src/models/Attendance');
const Assignment = require('./src/models/Assignment');
const Job = require('./src/models/Job');
const WorkerProfile = require('./src/models/WorkerProfile');

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  // Find all payments
  const payments = await Payment.find({}).populate('jobId', 'title status').populate('workerId', 'email').lean();
  console.log('\n=== ALL PAYMENTS ===');
  for (const p of payments) {
    console.log(`  Payment ID: ${p._id}`);
    console.log(`    Job: ${p.jobId?.title} (status: ${p.jobId?.status})`);
    console.log(`    Worker: ${p.workerId?.email}`);
    console.log(`    AssignmentId: ${p.assignmentId}`);
    console.log(`    Payment Status: ${p.status}`);
    console.log(`    Amount: ${p.amount}`);
    console.log(`    TransactionRef: ${p.transactionRef}`);
    console.log(`    ExpectedDate: ${p.expectedPaymentDate}`);
    console.log('');
  }

  // Find all attendance records
  const attendances = await Attendance.find({}).populate('jobId', 'title status').populate('workerId', 'email').lean();
  console.log('\n=== ALL ATTENDANCE RECORDS ===');
  for (const a of attendances) {
    console.log(`  Attendance ID: ${a._id}`);
    console.log(`    Job: ${a.jobId?.title} (status: ${a.jobId?.status})`);
    console.log(`    Worker: ${a.workerId?.email}`);
    console.log(`    AssignmentId: ${a.assignmentId}`);
    console.log(`    Status: ${a.status}`);
    console.log(`    CheckIn: ${a.checkInTime}, CheckOut: ${a.checkOutTime}`);
    console.log('');
  }

  // Find all assignments
  const assignments = await Assignment.find({}).populate('jobId', 'title status').populate('workerId', 'email').lean();
  console.log('\n=== ALL ASSIGNMENTS ===');
  for (const a of assignments) {
    console.log(`  Assignment ID: ${a._id}`);
    console.log(`    Job: ${a.jobId?.title} (status: ${a.jobId?.status})`);
    console.log(`    Worker: ${a.workerId?.email}`);
    console.log(`    Status: ${a.status}`);
    console.log('');
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);
