const mongoose = require('mongoose');
const User = require('./src/models/User');
const Payment = require('./src/models/Payment');
const Job = require('./src/models/Job');
const Assignment = require('./src/models/Assignment');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const http = require('http');

const req = (method, path, body, headers = {}) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) r.write(data);
    r.end();
  });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Get Admin Token
  const rAdmin = await req('POST', '/auth/login', { email: 'supportjobbyhop@gmail.com', password: 'admin123' });
  const adminToken = rAdmin.body.token;

  // 2. Create mock Job, Worker, Assignment, Payment
  const workerEmail = `payment_test_${Date.now()}@test.com`;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);
  const worker = await User.create({ email: workerEmail, phone: `999${Date.now().toString().slice(-7)}`, passwordHash, role: 'WORKER', status: 'ACTIVE' });
  
  const job = await Job.create({
    recruiterId: worker._id,
    title: 'Test Payment Job',
    eventType: 'Wedding',
    description: 'Test description',
    workersRequired: 1,
    recruiterProposedPayment: 500,
    eventDate: new Date(),
    startTime: '10:00',
    endTime: '18:00',
    location: 'Test Loc',
    workerCount: 1,
    estimatedPay: 500,
    status: 'APPROVED',
    adminApprovedPayment: 500
  });

  const Application = require('./src/models/Application');
  const application = await Application.create({
    jobId: job._id,
    workerId: worker._id,
    status: 'APPROVED'
  });

  const assignment = await Assignment.create({
    jobId: job._id,
    workerId: worker._id,
    applicationId: application._id,
    status: 'COMPLETED',
    assignedByAdminId: worker._id
  });

  const payment = await Payment.create({
    assignmentId: assignment._id,
    jobId: job._id,
    workerId: worker._id,
    amount: 500,
    status: 'PENDING',
    expectedPaymentDate: new Date(Date.now() + 15*24*60*60*1000)
  });

  console.log(`Created Payment ID: ${payment._id}`);

  // 3. Admin updates payment to PAID + UTR
  const rUpdate = await req('PUT', '/admin/payments/status', {
    paymentId: payment._id,
    status: 'PAID',
    transactionRef: '9214535240',
    adminNotes: 'All good'
  }, { Authorization: `Bearer ${adminToken}` });
  console.log(`Admin update payment status: ${rUpdate.status === 200 ? 'PASS' : 'FAIL'}`, rUpdate.body);

  // 4. Worker logs in and checks payments
  const rWorker = await req('POST', '/auth/login', { email: workerEmail, password: 'password123' });
  const workerToken = rWorker.body.token;

  const rWorkerPayments = await req('GET', '/worker/payments', null, { Authorization: `Bearer ${workerToken}` });
  console.log(`Worker GET payments status: ${rWorkerPayments.status === 200 ? 'PASS' : 'FAIL'}`);
  
  const wPay = rWorkerPayments.body.payments[0];
  console.log(`Worker Payment checks:`);
  console.log(`- Status is PAID: ${wPay.status === 'PAID' ? 'PASS' : 'FAIL'} (${wPay.status})`);
  console.log(`- UTR is 9214535240: ${wPay.transactionRef === '9214535240' ? 'PASS' : 'FAIL'} (${wPay.transactionRef})`);
  console.log(`- PaidAt is set: ${!!wPay.paidAt ? 'PASS' : 'FAIL'} (${wPay.paidAt})`);
  console.log(`- Admin notes NOT exposed: ${wPay.adminNotes === 'All good' ? 'FAIL' : 'PASS (Not explicitly removed by API, but UI ignores it)'}`);

  await mongoose.disconnect();
}
run();
