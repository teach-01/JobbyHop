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

async function testFullRegFlow() {
  await mongoose.connect(process.env.MONGODB_URI);
  const OtpStore = require('./src/models/OtpStore');
  const User = require('./src/models/User');

  const timestamp = Date.now();
  const email = `newworker_${timestamp}@jobbyhop.com`;
  const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const password = 'Password@123';

  console.log('1. Pre-verifying email in OtpStore:', email);
  await OtpStore.create({
    email,
    otpHash: 'dummyhash',
    expiresAt: new Date(Date.now() + 300000),
    verified: true,
  });

  console.log('\n2. Register Worker Account');
  const regRes = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/register/worker', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      fullName: 'New Worker Test',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      location: 'Mumbai, MH',
      dob: '2000-01-01',
      phone: phone,
      email: email,
      password: password,
      skills: ['Ushers'],
    }
  );
  console.log('Register res status:', regRes.status, regRes.data);

  console.log('\n3. Inspect User Document in Database');
  const createdUser = await User.findOne({ email });
  console.log('User document:', {
    id: createdUser._id,
    email: createdUser.email,
    phone: createdUser.phone,
    role: createdUser.role,
    status: createdUser.status,
    mustChangePassword: createdUser.mustChangePassword,
    profileCompleted: createdUser.profileCompleted,
    passwordHashExists: Boolean(createdUser.passwordHash),
  });

  console.log('\n4. Login as New Account');
  const loginRes = await request(
    { host: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: email, password: password }
  );
  console.log('Login res status:', loginRes.status, loginRes.data);

  if (loginRes.data.token) {
    console.log('\n5. Call GET /api/auth/me with New Account Token');
    const meRes = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${loginRes.data.token}` },
    });
    console.log('GET /auth/me status:', meRes.status, meRes.data);
  }

  process.exit(0);
}

testFullRegFlow();
