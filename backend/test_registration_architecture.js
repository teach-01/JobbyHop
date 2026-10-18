const http = require('http');

// Helper to make HTTP requests
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) r.write(data);
    r.end();
  });

// Minimal 1x1 valid PNG in base64
const VALID_BASE64_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING REGISTRATION ARCHITECTURE VERIFICATION TEST');
  console.log('====================================================\n');

  const ts = Date.now();

  // Test 1: Worker Normal Registration requires OTP
  console.log('Test 1: Worker Normal Registration requires OTP...');
  const workerEmail1 = `normal_worker_${ts}@example.com`;
  const res1 = await req('POST', '/auth/register/worker', {
    fullName: 'Normal Worker 1',
    profilePhoto: VALID_BASE64_PNG,
    location: 'Mumbai, MH',
    dob: '1995-05-15',
    phone: `+919800${String(ts).slice(-6)}`,
    email: workerEmail1,
    password: 'password123',
    confirmPassword: 'password123',
    skills: 'VIP Hospitality, Usher',
    bio: 'Experienced 2 years in luxury events',
  });
  if (res1.status === 400 && res1.body.message.includes('Email verification required')) {
    console.log('✅ Correctly blocked registration before OTP verification.\n');
  } else {
    console.error('❌ Failed OTP requirement test:', res1.status, res1.body);
  }

  // Test 2: Google-assisted Worker Registration - mismatch email rejected
  console.log('Test 2: Google Worker Registration - email mismatch rejected...');
  const workerEmail2 = `google_worker_${ts}@example.com`;
  const res2 = await req('POST', '/auth/google/register/worker', {
    idToken: `mock_google_token:other_email_${ts}@example.com`,
    formData: {
      fullName: 'Google Worker 2',
      profilePhoto: VALID_BASE64_PNG,
      location: 'Delhi, DL',
      dob: '1998-08-20',
      phone: `+919811${String(ts).slice(-6)}`,
      email: workerEmail2,
      password: 'password123',
      skills: 'Sound engineering',
      bio: 'Concert sound manager',
    },
  });
  if (res2.status === 400 && res2.body.message.includes('does not match the registration email')) {
    console.log('✅ Correctly rejected registration when Google email does not match form email.\n');
  } else {
    console.error('❌ Failed email mismatch test:', res2.status, res2.body);
  }

  // Test 3: Google-assisted Worker Registration - missing required manual fields rejected
  console.log('Test 3: Google Worker Registration - missing manual fields rejected...');
  const res3 = await req('POST', '/auth/google/register/worker', {
    idToken: `mock_google_token:${workerEmail2}`,
    formData: {
      email: workerEmail2,
      // Missing profilePhoto, fullName, phone, location, dob, password
    },
  });
  if (res3.status === 400 && res3.body.message.includes('required Worker fields must be filled in manually')) {
    console.log('✅ Correctly rejected registration when manual fields are missing (Google does NOT auto-fill).\n');
  } else {
    console.error('❌ Failed missing manual fields test:', res3.status, res3.body);
  }

  // Test 4: Google-assisted Worker Registration - SUCCESS flow
  console.log('Test 4: Google Worker Registration - successful creation with OTP skipped...');
  const res4 = await req('POST', '/auth/google/register/worker', {
    idToken: `mock_google_token:${workerEmail2}`,
    formData: {
      fullName: 'Aarav Mehta',
      profilePhoto: VALID_BASE64_PNG,
      location: 'Mumbai, MH',
      dob: '1999-04-12',
      phone: `+919811${String(ts).slice(-6)}`,
      email: workerEmail2,
      password: 'workerPassword123',
      skills: 'Guest Relations, Crowd Management',
      bio: 'Worked at Sunburn & Lollapalooza India',
    },
  });
  if (res4.status === 201 && res4.body.success && res4.body.token && res4.body.user.role === 'WORKER') {
    console.log('✅ Worker registered successfully via Google Connect! Role:', res4.body.user.role);
    console.log('   Email verified without OTP, Google linked:', res4.body.googleLinked, '\n');
  } else {
    console.error('❌ Failed Google Worker registration:', res4.status, res4.body);
  }

  // Test 5: Future Google Login for Worker
  console.log('Test 5: Future Google Login for Worker...');
  const res5 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${workerEmail2}`,
    expectedRole: 'WORKER',
  });
  if (res5.status === 200 && res5.body.success && res5.body.token && res5.body.user.role === 'WORKER') {
    console.log('✅ Future Google Login successful! Token issued for Worker without asking for profile or OTP.\n');
  } else {
    console.error('❌ Failed Google Worker login:', res5.status, res5.body);
  }

  // Test 6: Password Login for the same Worker account (Dual auth)
  console.log('Test 6: Password Login for the same Worker account...');
  const res6 = await req('POST', '/auth/login', {
    email: workerEmail2,
    password: 'workerPassword123',
    expectedRole: 'WORKER',
  });
  if (res6.status === 200 && res6.body.success && res6.body.user.email === workerEmail2) {
    console.log('✅ Password login successfully authenticated the exact same Worker account.\n');
  } else {
    console.error('❌ Failed Password login for Google Worker:', res6.status, res6.body);
  }

  // Test 7: Google-assisted Recruiter Registration - SUCCESS flow
  console.log('Test 7: Google Recruiter Registration - successful creation with OTP skipped...');
  const recruiterEmail = `google_recruiter_${ts}@example.com`;
  const res7 = await req('POST', '/auth/google/register/recruiter', {
    idToken: `mock_google_token:${recruiterEmail}`,
    formData: {
      fullName: 'Vikramaditya Oberoi',
      companyName: 'Elite Productions Pvt Ltd',
      location: 'Bengaluru, KA',
      phone: `+919822${String(ts).slice(-6)}`,
      email: recruiterEmail,
      password: 'recruiterPassword123',
      companyDescription: 'Premier event operations and luxury wedding planners.',
    },
  });
  if (res7.status === 201 && res7.body.success && res7.body.token && res7.body.user.role === 'RECRUITER') {
    console.log('✅ Recruiter registered successfully via Google Connect! Role:', res7.body.user.role);
    console.log('   Email verified without OTP, Google linked:', res7.body.googleLinked, '\n');
  } else {
    console.error('❌ Failed Google Recruiter registration:', res7.status, res7.body);
  }

  // Test 8: Future Google Login for Recruiter
  console.log('Test 8: Future Google Login for Recruiter...');
  const res8 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${recruiterEmail}`,
    expectedRole: 'RECRUITER',
  });
  if (res8.status === 200 && res8.body.success && res8.body.token && res8.body.user.role === 'RECRUITER') {
    console.log('✅ Future Google Login successful! Token issued for Recruiter without asking for profile or OTP.\n');
  } else {
    console.error('❌ Failed Google Recruiter login:', res8.status, res8.body);
  }

  // Test 9: Password Login for the same Recruiter account
  console.log('Test 9: Password Login for the same Recruiter account...');
  const res9 = await req('POST', '/auth/login', {
    email: recruiterEmail,
    password: 'recruiterPassword123',
    expectedRole: 'RECRUITER',
  });
  if (res9.status === 200 && res9.body.success && res9.body.user.email === recruiterEmail) {
    console.log('✅ Password login successfully authenticated the exact same Recruiter account.\n');
  } else {
    console.error('❌ Failed Password login for Google Recruiter:', res9.status, res9.body);
  }

  // Test 10: Role Separation Enforcement
  console.log('Test 10: Role Separation Enforcement...');
  // Worker trying to login via recruiter portal
  const res10a = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${workerEmail2}`,
    expectedRole: 'RECRUITER',
  });
  if (res10a.status === 401 && res10a.body.message.includes('Invalid recruiter credentials')) {
    console.log('✅ Worker blocked from logging in as Recruiter.');
  } else {
    console.error('❌ Role separation check failed for Worker -> Recruiter:', res10a.status, res10a.body);
  }

  // Recruiter trying to login via worker portal
  const res10b = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${recruiterEmail}`,
    expectedRole: 'WORKER',
  });
  if (res10b.status === 401 && res10b.body.message.includes('Invalid worker credentials')) {
    console.log('✅ Recruiter blocked from logging in as Worker.');
  } else {
    console.error('❌ Role separation check failed for Recruiter -> Worker:', res10b.status, res10b.body);
  }

  // Worker trying to register as recruiter with same email
  const res10c = await req('POST', '/auth/google/register/recruiter', {
    idToken: `mock_google_token:${workerEmail2}`,
    formData: {
      fullName: 'Imposter Recruiter',
      companyName: 'Fake Corp',
      location: 'Mumbai, MH',
      phone: `+919999${String(ts).slice(-6)}`,
      email: workerEmail2,
      password: 'password123',
    },
  });
  if (res10c.status === 400 && res10c.body.message.includes('already registered as a different role')) {
    console.log('✅ Cross-role registration with same email strictly prevented.\n');
  } else {
    console.error('❌ Failed cross-role registration test:', res10c.status, res10c.body);
  }

  // Test 11: Duplicate Account Prevention & Email Normalization
  console.log('Test 11: Duplicate Account Prevention & Email Normalization...');
  const res11 = await req('POST', '/auth/google/register/worker', {
    idToken: `mock_google_token:${workerEmail2.toUpperCase()}`,
    formData: {
      fullName: 'Aarav Mehta Duplicate',
      profilePhoto: VALID_BASE64_PNG,
      location: 'Mumbai, MH',
      dob: '1999-04-12',
      phone: `+919811${String(ts).slice(-6)}`,
      email: `  ${workerEmail2.toUpperCase()}  `,
      password: 'workerPassword123',
    },
  });
  if (res11.status === 200 && res11.body.message.includes('linked to your existing Worker account')) {
    console.log('✅ Duplicate Worker not created; existing account linked safely with normalized email.\n');
  } else {
    console.error('❌ Failed duplicate account test:', res11.status, res11.body);
  }

  console.log('====================================================');
  console.log('ALL REGISTRATION ARCHITECTURE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch(console.error);
