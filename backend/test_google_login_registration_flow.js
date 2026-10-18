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

const VALID_BASE64_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('================================================================');
  console.log('TESTING GOOGLE LOGIN -> ROLE-SPECIFIC REGISTRATION FLOW');
  console.log('================================================================\n');

  const ts = Date.now();

  // 1. New Google user signs in via Google Login (the previously broken flow)
  console.log('Test 1: New Google user signs in on Login Page...');
  const newGoogleWorkerEmail = `brand_new_worker_${ts}@example.com`;
  const loginRes1 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleWorkerEmail}`,
  });

  if (
    loginRes1.status === 200 &&
    loginRes1.body.success &&
    loginRes1.body.isNewUser === true &&
    loginRes1.body.googleEmail === newGoogleWorkerEmail &&
    loginRes1.body.registrationToken
  ) {
    console.log('✅ PASS: Google login returned isNewUser: true with registrationToken (no 404 block!).\n');
  } else {
    console.error('❌ FAIL: Expected 200 with isNewUser: true and registrationToken, got:', loginRes1.status, loginRes1.body);
    process.exit(1);
  }

  const workerRegToken = loginRes1.body.registrationToken;

  // 2. Worker chooses "Register as Worker" and attempts with email mismatch
  console.log('Test 2: Worker Google Registration rejects email mismatch...');
  const mismatchRes = await req('POST', '/auth/google/register/worker', {
    registrationToken: workerRegToken,
    formData: {
      fullName: 'Worker Mismatch',
      profilePhoto: VALID_BASE64_PNG,
      location: 'Mumbai, MH',
      dob: '1998-05-10',
      phone: `+919830${String(ts).slice(-6)}`,
      email: `different_email_${ts}@example.com`,
      password: 'workerPassword123',
    },
  });

  if (mismatchRes.status === 400 && mismatchRes.body.message.includes('does not match the registration email')) {
    console.log('✅ PASS: Mismatched email rejected before registration.\n');
  } else {
    console.error('❌ FAIL: Expected 400 email mismatch, got:', mismatchRes.status, mismatchRes.body);
    process.exit(1);
  }

  // 3. Worker completes registration with valid matching details and registrationToken
  console.log('Test 3: Worker completes registration using registrationToken (skipping OTP)...');
  const workerRegSuccess = await req('POST', '/auth/google/register/worker', {
    registrationToken: workerRegToken,
    formData: {
      fullName: 'Rohan Deshmukh',
      profilePhoto: VALID_BASE64_PNG,
      location: 'Mumbai, MH',
      dob: '1997-11-23',
      phone: `+919830${String(ts).slice(-6)}`,
      email: newGoogleWorkerEmail,
      password: 'workerPassword123',
      skills: 'Hospitality, Stage Setup',
      bio: '3 years concert experience',
    },
  });

  if (
    workerRegSuccess.status === 201 &&
    workerRegSuccess.body.success &&
    workerRegSuccess.body.token &&
    workerRegSuccess.body.user.role === 'WORKER' &&
    workerRegSuccess.body.googleLinked === true
  ) {
    console.log('✅ PASS: Worker registered, Google linked, token issued, role is WORKER.\n');
  } else {
    console.error('❌ FAIL: Expected 201 Worker registration, got:', workerRegSuccess.status, workerRegSuccess.body);
    process.exit(1);
  }

  // 4. Future Google Login for this Worker account
  console.log('Test 4: Future Google Login for this now-existing Worker account...');
  const futureWorkerLogin = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleWorkerEmail}`,
    expectedRole: 'WORKER',
  });

  if (
    futureWorkerLogin.status === 200 &&
    futureWorkerLogin.body.success &&
    futureWorkerLogin.body.user &&
    futureWorkerLogin.body.user.role === 'WORKER' &&
    !futureWorkerLogin.body.isNewUser
  ) {
    console.log('✅ PASS: Future Google login directly authenticates Worker without asking for profile or OTP.\n');
  } else {
    console.error('❌ FAIL: Expected 200 existing Worker login, got:', futureWorkerLogin.status, futureWorkerLogin.body);
    process.exit(1);
  }

  // 5. Password Login for the same Worker account
  console.log('Test 5: Password Login for the Worker account...');
  const passWorkerLogin = await req('POST', '/auth/login', {
    email: newGoogleWorkerEmail,
    password: 'workerPassword123',
    expectedRole: 'WORKER',
  });

  if (passWorkerLogin.status === 200 && passWorkerLogin.body.success && passWorkerLogin.body.user.role === 'WORKER') {
    console.log('✅ PASS: Password login verified for Google-registered Worker.\n');
  } else {
    console.error('❌ FAIL: Expected 200 password login, got:', passWorkerLogin.status, passWorkerLogin.body);
    process.exit(1);
  }

  // 6. New Google user chooses Recruiter registration
  console.log('Test 6: New Google user chooses Recruiter registration...');
  const newGoogleRecruiterEmail = `brand_new_recruiter_${ts}@example.com`;
  const loginRes2 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleRecruiterEmail}`,
  });

  if (loginRes2.status === 200 && loginRes2.body.isNewUser && loginRes2.body.registrationToken) {
    console.log('✅ PASS: New Google recruiter receives registrationToken.');
  } else {
    console.error('❌ FAIL: Google login for new recruiter failed:', loginRes2.status, loginRes2.body);
    process.exit(1);
  }

  const recruiterRegToken = loginRes2.body.registrationToken;

  const recruiterRegSuccess = await req('POST', '/auth/google/register/recruiter', {
    registrationToken: recruiterRegToken,
    formData: {
      fullName: 'Siddharth Singhania',
      companyName: 'Apex Event Agency',
      location: 'Delhi, DL',
      phone: `+919840${String(ts).slice(-6)}`,
      email: newGoogleRecruiterEmail,
      password: 'recruiterPassword123',
      companyDescription: 'Full-service corporate summit management',
    },
  });

  if (
    recruiterRegSuccess.status === 201 &&
    recruiterRegSuccess.body.success &&
    recruiterRegSuccess.body.user.role === 'RECRUITER'
  ) {
    console.log('✅ PASS: Recruiter registered, Google linked, token issued, role is RECRUITER.\n');
  } else {
    console.error('❌ FAIL: Recruiter registration failed:', recruiterRegSuccess.status, recruiterRegSuccess.body);
    process.exit(1);
  }

  // 7. Future Google Login for this Recruiter account
  console.log('Test 7: Future Google Login for Recruiter account...');
  const futureRecruiterLogin = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleRecruiterEmail}`,
    expectedRole: 'RECRUITER',
  });

  if (
    futureRecruiterLogin.status === 200 &&
    futureRecruiterLogin.body.success &&
    futureRecruiterLogin.body.user.role === 'RECRUITER'
  ) {
    console.log('✅ PASS: Future Google login directly authenticates Recruiter.\n');
  } else {
    console.error('❌ FAIL: Expected 200 existing Recruiter login, got:', futureRecruiterLogin.status, futureRecruiterLogin.body);
    process.exit(1);
  }

  // 8. Password Login for the same Recruiter account
  console.log('Test 8: Password Login for the Recruiter account...');
  const passRecruiterLogin = await req('POST', '/auth/login', {
    email: newGoogleRecruiterEmail,
    password: 'recruiterPassword123',
    expectedRole: 'RECRUITER',
  });

  if (passRecruiterLogin.status === 200 && passRecruiterLogin.body.success && passRecruiterLogin.body.user.role === 'RECRUITER') {
    console.log('✅ PASS: Password login verified for Google-registered Recruiter.\n');
  } else {
    console.error('❌ FAIL: Expected 200 password login, got:', passRecruiterLogin.status, passRecruiterLogin.body);
    process.exit(1);
  }

  // 9. Role Separation: Worker cannot Google login as Recruiter
  console.log('Test 9: Role Separation verification...');
  const crossLogin1 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleWorkerEmail}`,
    expectedRole: 'RECRUITER',
  });
  if (crossLogin1.status === 401 && crossLogin1.body.message.includes('Invalid recruiter credentials')) {
    console.log('✅ PASS: Worker account cannot log into Recruiter portal via Google.');
  } else {
    console.error('❌ FAIL: Worker cross-login not blocked:', crossLogin1.status, crossLogin1.body);
    process.exit(1);
  }

  // 10. Role Separation: Recruiter cannot Google login as Worker
  const crossLogin2 = await req('POST', '/auth/google/login', {
    idToken: `mock_google_token:${newGoogleRecruiterEmail}`,
    expectedRole: 'WORKER',
  });
  if (crossLogin2.status === 401 && crossLogin2.body.message.includes('Invalid worker credentials')) {
    console.log('✅ PASS: Recruiter account cannot log into Worker portal via Google.\n');
  } else {
    console.error('❌ FAIL: Recruiter cross-login not blocked:', crossLogin2.status, crossLogin2.body);
    process.exit(1);
  }

  // 11. Normal registration still requires OTP
  console.log('Test 11: Normal registration continues requiring OTP...');
  const normalWorkerEmail = `normal_check_${ts}@example.com`;
  const normalRegRes = await req('POST', '/auth/register/worker', {
    fullName: 'Normal User',
    profilePhoto: VALID_BASE64_PNG,
    location: 'Mumbai, MH',
    dob: '1995-01-01',
    phone: `+919850${String(ts).slice(-6)}`,
    email: normalWorkerEmail,
    password: 'password123',
  });
  if (normalRegRes.status === 400 && normalRegRes.body.message.includes('Email verification required')) {
    console.log('✅ PASS: Normal registration correctly requires email OTP verification.\n');
  } else {
    console.error('❌ FAIL: Normal registration did not require OTP:', normalRegRes.status, normalRegRes.body);
    process.exit(1);
  }

  console.log('================================================================');
  console.log('ALL 11 TESTS PASSED SUCCESSFULLY! GOOGLE LOGIN -> REGISTRATION FIXED.');
  console.log('================================================================');
}

runTests().catch(console.error);
