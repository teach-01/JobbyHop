const mongoose = require('mongoose');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const http = require('http');

const req = (method, path, body) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
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

let adminToken = '';

async function loginAdmin() {
  const r = await req('POST', '/auth/login', { email: 'supportjobbyhop@gmail.com', password: 'admin123' });
  if (r.status === 200 && r.body.token) {
    adminToken = r.body.token;
  } else {
    throw new Error('Failed to login Admin');
  }
}

const reqAuth = (method, path, body) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
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
  console.log('Connected to DB for setup');

  // Create a worker bypassing registration OTP
  const email = `testworker_${Date.now()}@test.com`;
  const password = 'password123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const user = await User.create({
    email,
    phone: `+91 ${Date.now().toString().slice(-10)}`,
    passwordHash,
    role: 'WORKER',
    status: 'ACTIVE',
  });
  
  console.log(`Created test worker: ${email} [${user._id}]`);

  // Login as admin
  await loginAdmin();

  // Test 1: ACTIVE login (PASS)
  console.log(`\n--- Test 1: ACTIVE ---`);
  let res = await req('POST', '/auth/login', { email, password });
  console.log(`ACTIVE Login: ${res.status === 200 ? 'PASS' : 'FAIL'} (${res.status})`);

  // Test 2: SUSPENDED
  console.log(`\n--- Test 2: SUSPENDED ---`);
  let adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'SUSPENDED' });
  console.log(`Admin set SUSPENDED: ${adminRes.status === 200 ? 'PASS' : 'FAIL'} (${JSON.stringify(adminRes.body)})`);
  res = await req('POST', '/auth/login', { email, password });
  console.log(`SUSPENDED Login: ${res.status === 403 ? 'FAIL (PASS)' : 'PASS (FAIL)'} (${res.body.message})`);
  adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'ACTIVE' });
  console.log(`Admin ACTIVATE: ${adminRes.status === 200 ? 'PASS' : 'FAIL'}`);
  res = await req('POST', '/auth/login', { email, password });
  console.log(`Re-Login: ${res.status === 200 ? 'PASS' : 'FAIL'}`);

  // Test 3: BLOCKED
  console.log(`\n--- Test 3: BLOCKED ---`);
  adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'BLOCKED' });
  res = await req('POST', '/auth/login', { email, password });
  console.log(`BLOCKED Login: ${res.status === 403 ? 'FAIL (PASS)' : 'PASS (FAIL)'} (${res.body.message})`);
  adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'ACTIVE' });
  res = await req('POST', '/auth/login', { email, password });
  console.log(`Re-Login: ${res.status === 200 ? 'PASS' : 'FAIL'}`);

  // Test 4: DEACTIVATED
  console.log(`\n--- Test 4: DEACTIVATED ---`);
  adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'DEACTIVATED' });
  res = await req('POST', '/auth/login', { email, password });
  console.log(`DEACTIVATED Login: ${res.status === 403 ? 'FAIL (PASS)' : 'PASS (FAIL)'} (${res.body.message})`);
  adminRes = await reqAuth('POST', '/admin/users/status', { userId: user._id, status: 'ACTIVE' });
  res = await req('POST', '/auth/login', { email, password });
  console.log(`Re-Login: ${res.status === 200 ? 'PASS' : 'FAIL'}`);

  // Test 5: DELETED (Soft delete) & Email Reuse
  console.log(`\n--- Test 5: DELETED & REUSE ---`);
  adminRes = await reqAuth('DELETE', `/admin/users/${user._id}`);
  console.log(`Admin DELETE: ${adminRes.status === 200 ? 'PASS' : 'FAIL'}`);
  res = await req('POST', '/auth/login', { email, password });
  console.log(`DELETED Login: ${res.status === 401 ? 'FAIL (PASS)' : 'PASS (FAIL)'} (${res.body.message})`);

  // Verify email reuse by creating a new account with the same email
  const user2 = await User.create({
    email,
    phone: `+91 ${Date.now().toString().slice(-10)}`,
    passwordHash,
    role: 'WORKER',
    status: 'ACTIVE',
  });
  console.log(`Created NEW test worker with same email: ${user2.email} [${user2._id}]`);

  // Login with reused email (should succeed and pick the new one)
  res = await req('POST', '/auth/login', { email, password });
  console.log(`Reused Email Login: ${res.status === 200 ? 'PASS' : 'FAIL'} (User ID matched: ${res.body.user?._id === user2._id.toString()})`);

  await mongoose.disconnect();
}

run().catch(console.error);
