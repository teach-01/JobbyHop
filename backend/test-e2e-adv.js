const fs = require('fs');

const runTests = async () => {
  try {
    console.log('--- STARTING ADVANCED E2E VERIFICATION ---');
    
    // 1. LOGIN
    let res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operations@jobbyhop.com', password: 'Operations@123' })
    });
    let data = await res.json();
    const token = data.token;
    
    // Admin login
    let adminRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'supportjobbyhop@gmail.com', password: 'admin123' })
    });
    let adminData = await adminRes.json();
    const adminToken = adminData.token;

    // 2. FETCH ATTENDANCE
    res = await fetch('http://localhost:5000/api/operations/attendance', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    
    if (data.attendance && data.attendance.length > 0) {
        const attId = data.attendance[0]._id;
        console.log(`✅ Found Attendance record: ${attId}`);
        
        // 3. OPERATIONS UPDATE (UNLOCKED)
        res = await fetch(`http://localhost:5000/api/operations/attendance/${attId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: 'PRESENT' })
        });
        let updateData = await res.json();
        if (updateData.success) {
            console.log('✅ Operations successfully updated unlocked attendance');
        } else {
            console.log('❌ Operations update failed:', updateData.message);
        }

        // 4. ADMIN LOCKS IT
        res = await fetch(`http://localhost:5000/api/admin/attendance`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ attendanceId: attId, status: 'ABSENT' })
        });
        let adminLockData = await res.json();
        if (adminLockData.success) {
            console.log('✅ Admin successfully verified (locked) attendance');
        } else {
            console.log('❌ Admin lock failed:', adminLockData.message);
        }

        // 5. OPERATIONS TRY TO UPDATE LOCKED RECORD
        res = await fetch(`http://localhost:5000/api/operations/attendance/${attId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: 'PRESENT' })
        });
        let lockData = await res.json();
        if (res.status === 403 && !lockData.success) {
            console.log('✅ Operations blocked from updating locked record (403)');
        } else {
            console.log('❌ Operations was incorrectly allowed to update locked record!');
        }

        // 6. ADMIN TRY TO OVERRIDE LOCKED RECORD
        res = await fetch(`http://localhost:5000/api/operations/attendance/${attId}`, {
            method: 'PATCH', // hitting the operations endpoint using admin credentials
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status: 'PRESENT' })
        });
        let adminOverrideData = await res.json();
        if (adminOverrideData.success) {
            console.log('✅ Admin successfully bypassed lock via operations route');
        } else {
            console.log('❌ Admin failed to bypass lock:', adminOverrideData.message);
        }

        // 7. CHECK AUDIT LOGS
        res = await fetch('http://localhost:5000/api/operations/audit', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let auditData = await res.json();
        console.log(`✅ Audit History fetched. Logs count: ${auditData.logs.length}`);
    } else {
        console.log('⚠️ No attendance records to test locking mechanism.');
    }

    console.log('--- ADVANCED VERIFICATION COMPLETED ---');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
  }
};

runTests();
