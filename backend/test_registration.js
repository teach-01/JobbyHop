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

const ts = Date.now();
const testRecruiter = { 
  fullName: 'Test Recruiter',
  companyName: 'Test Company',
  location: 'Test Location',
  phone: '1234567890',
  email: `real_recruiter_${ts}@test.com`, 
  password: 'password123'
};
const testWorker = { 
  fullName: 'Test Worker',
  profilePhoto: 'test.jpg',
  location: 'Test Location',
  dob: '2000-01-01',
  phone: '1234567890',
  email: `real_worker_${ts}@test.com`, 
  password: 'password123' 
};

async function run() {
  console.log('Testing fresh registrations...');
  
  // Register Recruiter
  const r1 = await req('POST', '/auth/register/recruiter', testRecruiter);
  if (r1.status === 201) {
    console.log(`✅ Recruiter registered: ${testRecruiter.email}`);
  } else {
    console.error(`❌ Recruiter registration failed:`, r1.body);
  }

  // Register Worker
  const r2 = await req('POST', '/auth/register/worker', testWorker);
  if (r2.status === 201) {
    console.log(`✅ Worker registered: ${testWorker.email}`);
  } else {
    console.error(`❌ Worker registration failed:`, r2.body);
  }
}

run().catch(console.error);
