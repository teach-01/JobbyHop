const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('./src/models/Payment');
const Attendance = require('./src/models/Attendance');
const Job = require('./src/models/Job');
const User = require('./src/models/User');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const payments = await Payment.find({}).populate('jobId').populate('workerId');
  console.log('--- PAYMENTS ---');
  payments.forEach(p => {
    console.log(`Payment: ${p._id}, Status: ${p.status}, Worker: ${p.workerId?.email}, Job: ${p.jobId?.title}`);
  });

  const attendances = await Attendance.find({}).populate('jobId').populate('workerId');
  console.log('--- ATTENDANCES ---');
  attendances.forEach(a => {
    console.log(`Attendance: ${a._id}, Status: ${a.status}, Worker: ${a.workerId?.email}, Job: ${a.jobId?.title}`);
  });

  await mongoose.disconnect();
}
check().catch(console.error);
