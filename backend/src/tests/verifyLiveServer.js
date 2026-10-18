const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runLiveVerification() {
  console.log('--- STARTING LIVE BACKEND VERIFICATION ON PORT 5000 ---');

  // 1. Admin login
  console.log('1. Logging in as Admin...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'supportjobbyhop@gmail.com', password: 'admin123' }
  );

  if (loginRes.status !== 200 || !loginRes.body.token) {
    console.error('Admin login failed:', loginRes);
    process.exit(1);
  }
  const token = loginRes.body.token;
  console.log('✅ Admin login SUCCESS! Token obtained.');

  // 2. Fetch all jobs
  console.log('2. Fetching existing jobs via GET /api/admin/job-requests...');
  const jobsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/job-requests',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (jobsRes.status !== 200 || !jobsRes.body.jobs) {
    console.error('Fetch jobs failed:', jobsRes);
    process.exit(1);
  }
  console.log(`✅ Fetched ${jobsRes.body.jobs.length} jobs successfully from live database.`);

  const targetJob = jobsRes.body.jobs.find((j) => j.status === 'APPROVED' || j.status === 'COMPLETED') || jobsRes.body.jobs[0];
  if (!targetJob) {
    console.log('No job found in DB to test.');
    process.exit(0);
  }
  console.log(`Target Job: ${targetJob.title} (ID: ${targetJob._id}, Status: ${targetJob.status}, RecruiterPaymentStatus: ${targetJob.recruiterPaymentStatus})`);

  // 3. Test updating event with recruiterPaymentStatus: 'PAID'
  console.log('3. Testing event update with recruiterPaymentStatus: PAID...');
  const updateRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/jobs/${targetJob._id}/review`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      title: targetJob.title,
      recruiterPaymentStatus: 'PAID',
    }
  );

  if (updateRes.status !== 200) {
    console.error('❌ Update failed with error:', updateRes.body);
    process.exit(1);
  }
  console.log('✅ Update SUCCESS! No enum error! Updated job payment status:', updateRes.body.job.recruiterPaymentStatus);

  // 4. Test Complete Event
  console.log('4. Testing Complete Event via POST /api/admin/events/:id/complete...');
  const completeRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/events/${targetJob._id}/complete`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { adminNotes: 'Live verification test completion notes' }
  );

  if (completeRes.status !== 200) {
    console.error('❌ Complete Event failed:', completeRes.body);
    process.exit(1);
  }
  console.log('✅ Complete Event SUCCESS! Status is now:', completeRes.body.job.status, 'CompletedAt:', completeRes.body.job.completedAt);

  // 5. Test Reopen Event
  console.log('5. Testing Reopen Event via POST /api/admin/events/:id/reopen...');
  const reopenRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/events/${targetJob._id}/reopen`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { adminNotes: 'Live verification test reopen notes' }
  );

  if (reopenRes.status !== 200) {
    console.error('❌ Reopen Event failed:', reopenRes.body);
    process.exit(1);
  }
  console.log('✅ Reopen Event SUCCESS! Status returned to:', reopenRes.body.job.status, 'CompletedAt:', reopenRes.body.job.completedAt);

  console.log('--- ALL LIVE SERVER TESTS PASSED SUCCESSFULLY! ---');
}

runLiveVerification().catch(console.error);
