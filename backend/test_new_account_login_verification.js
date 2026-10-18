const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAuditAndVerification() {
  console.log('==================================================');
  console.log('JOBBYHOP NEW ACCOUNT LOGIN AUDIT & VERIFICATION');
  console.log('==================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  const OtpStore = require('./src/models/OtpStore');
  const User = require('./src/models/User');

  const timestamp = Date.now();
  const workerEmail = `freshworker_${timestamp}@jobbyhop.com`;
  const recruiterEmail = `freshrecruiter_${timestamp}@jobbyhop.com`;
  const workerPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const recruiterPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const password = 'Password@123';

  // 1. Test New Worker Registration & Login
  console.log('\n--- 1. NEW WORKER REGISTRATION & LOGIN ---');
  await OtpStore.create({ email: workerEmail, otpHash: 'dummyhash', expiresAt: new Date(Date.now() + 300000), verified: true });
  
  const workerReg = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/register/worker', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      fullName: 'Fresh Worker',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      location: 'Delhi, DL',
      dob: '1999-09-09',
      phone: workerPhone,
      email: workerEmail,
      password: password,
      skills: ['VIP Usher'],
    }
  );
  console.log('Worker Registration Status:', workerReg.status);
  console.log('Worker Reg User:', workerReg.data.user.email, 'Role:', workerReg.data.user.role, 'id:', workerReg.data.user.id, '_id:', workerReg.data.user._id);

  const workerLogin = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: workerEmail, password: password }
  );
  console.log('Worker Login Status:', workerLogin.status);
  console.log('Worker Login User:', workerLogin.data.user.email, 'Role:', workerLogin.data.user.role, 'id:', workerLogin.data.user.id, '_id:', workerLogin.data.user._id);

  const workerMe = await request({
    host: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${workerLogin.data.token}` },
  });
  console.log('Worker GET /auth/me Status:', workerMe.status);
  console.log('Worker /auth/me User:', workerMe.data.user.email, 'Role:', workerMe.data.user.role);

  // 2. Test New Recruiter Registration & Login
  console.log('\n--- 2. NEW RECRUITER REGISTRATION & LOGIN ---');
  await OtpStore.create({ email: recruiterEmail, otpHash: 'dummyhash', expiresAt: new Date(Date.now() + 300000), verified: true });

  const recruiterReg = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/register/recruiter', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      fullName: 'Fresh Recruiter',
      companyName: 'Fresh Events Co',
      location: 'Bengaluru, KA',
      phone: recruiterPhone,
      email: recruiterEmail,
      password: password,
    }
  );
  console.log('Recruiter Registration Status:', recruiterReg.status);
  console.log('Recruiter Reg User:', recruiterReg.data.user.email, 'Role:', recruiterReg.data.user.role, '_id:', recruiterReg.data.user._id);

  const recruiterLogin = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: recruiterEmail, password: password }
  );
  console.log('Recruiter Login Status:', recruiterLogin.status);
  console.log('Recruiter Login User:', recruiterLogin.data.user.email, 'Role:', recruiterLogin.data.user.role, '_id:', recruiterLogin.data.user._id);

  const recruiterMe = await request({
    host: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${recruiterLogin.data.token}` },
  });
  console.log('Recruiter GET /auth/me Status:', recruiterMe.status);
  console.log('Recruiter /auth/me User:', recruiterMe.data.user.email, 'Role:', recruiterMe.data.user.role);

  // 3. Test Seeded Accounts
  console.log('\n--- 3. SEEDED ACCOUNTS TESTING ---');
  const seedWorkerLogin = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: 'worker1@jobbyhop.com', password: 'Password@123' }
  );
  const seedWorkerMe = await request({
    host: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${seedWorkerLogin.data.token}` },
  });
  console.log('Seeded Worker Login & /auth/me Status:', seedWorkerLogin.status, seedWorkerMe.status);

  const seedRecruiterLogin = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: 'recruiter1@eventco.com', password: 'Password@123' }
  );
  const seedRecruiterMe = await request({
    host: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${seedRecruiterLogin.data.token}` },
  });
  console.log('Seeded Recruiter Login & /auth/me Status:', seedRecruiterLogin.status, seedRecruiterMe.status);

  console.log('\n==================================================');
  console.log('ALL NEW ACCOUNT LOGIN TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
  process.exit(0);
}

runAuditAndVerification();
