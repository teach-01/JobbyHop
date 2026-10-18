const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

async function testPass() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const targetEmail = 'aadishbwm0@gmail.com';
  const user = await User.findOne({ email: targetEmail, isDeleted: { $ne: true } });
  
  if (!user) {
    console.log('USER NOT FOUND');
    await mongoose.disconnect();
    process.exit(1);
  }
  
  console.log('Found user:', user.email, 'role:', user.role);
  console.log('Password hash:', user.passwordHash);
  console.log('Hash prefix (should be $2a$ or $2b$):', user.passwordHash.substring(0, 4));
  
  // Test a few common passwords to identify what was set
  const testPasswords = ['password', 'password123', 'Password123', 'Test@123', '123456', 'admin123', 'jobbyhop', 'Jobbyhop123'];
  
  for (const pw of testPasswords) {
    const match = await bcrypt.compare(pw, user.passwordHash);
    if (match) {
      console.log('\n✅ PASSWORD MATCH FOUND:', pw);
    }
  }
  
  console.log('\nPassword test complete.');
  
  await mongoose.disconnect();
  process.exit(0);
}
testPass().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
