const axios = require('axios');

async function run() {
  try {
    const API = axios.create({ baseURL: 'http://localhost:5000/api' });

    console.log('Logging in as worker...');
    const loginRes = await API.post('/auth/login', {
      email: 'alice.worker@example.com',
      password: 'Alicepass123!'
    });
    const token = loginRes.data.token;
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log('Fetching available jobs...');
    const jobsRes = await API.get('/worker/jobs');
    const jobs = jobsRes.data.jobs;
    if (jobs.length === 0) {
      console.log('No jobs found to apply to!');
      return;
    }
    const targetJobId = jobs[0]._id;

    console.log(`Applying to job ${targetJobId} for the first time...`);
    try {
       await API.post(`/worker/jobs/${targetJobId}/apply`);
       console.log('First application succeeded!');
    } catch (e) {
       console.log('First application already exists or failed:', e.response?.data || e.message);
    }

    console.log(`Applying to job ${targetJobId} for the SECOND time...`);
    try {
       const res2 = await API.post(`/worker/jobs/${targetJobId}/apply`);
       console.log('UH OH! Second application succeeded. This should not happen!', res2.data);
    } catch (e) {
       console.log('SUCCESS: Backend correctly rejected the duplicate application!');
       console.log('Backend Error Response:', e.response?.status, e.response?.data);
    }
  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message);
  }
}
run();
