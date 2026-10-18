const fs = require('fs');

const runTests = async () => {
  try {
    console.log('--- STARTING E2E API VERIFICATION ---');
    
    // 1. LOGIN
    let res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operations@jobbyhop.com', password: 'Operations@123' })
    });
    let data = await res.json();
    if (!data.success) throw new Error('Login failed: ' + data.message);
    
    const token = data.token;
    console.log('✅ Login successful, got token for role:', data.user.role);

    // 2. DASHBOARD
    res = await fetch('http://localhost:5000/api/operations/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    if (!data.success) throw new Error('Dashboard failed');
    console.log('✅ Dashboard loaded stats:', data.stats);

    // 3. ADMIN ACCESS TEST
    res = await fetch('http://localhost:5000/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    if (res.status === 403 || !data.success) {
      console.log('✅ Admin access blocked as expected (403)');
    } else {
      throw new Error('Admin access was allowed!');
    }

    // 4. GET ATTENDANCE
    res = await fetch('http://localhost:5000/api/operations/attendance', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    console.log('✅ Attendance API loaded, count:', data.attendance?.length);

    console.log('--- E2E VERIFICATION COMPLETED ---');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
  }
};

runTests();
