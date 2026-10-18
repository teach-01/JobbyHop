const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const targetEmail = 'aadishbwm0@gmail.com';
  
  // This is the exact query the login controller uses
  const userViaLoginQuery = await User.findOne({ email: targetEmail, isDeleted: { $ne: true } });
  console.log('\n--- LOGIN QUERY RESULT (email + isDeleted: {$ne: true}) ---');
  if (userViaLoginQuery) {
    console.log('Found user:', {
      email: userViaLoginQuery.email,
      role: userViaLoginQuery.role,
      status: userViaLoginQuery.status,
      isDeleted: userViaLoginQuery.isDeleted
    });
  } else {
    console.log('NO USER FOUND by login query!');
  }
  
  // Find ALL with this email
  const allWithEmail = await User.find({ email: targetEmail });
  console.log('\n--- ALL users with this email ---');
  allWithEmail.forEach((u, i) => {
    console.log(`[${i}]`, {
      _id: u._id.toString(),
      email: u.email,
      role: u.role,
      status: u.status,
      isDeleted: u.isDeleted
    });
  });
  
  // Check indexes
  const indexes = await User.collection.indexes();
  console.log('\n--- User collection indexes ---');
  indexes.forEach(idx => console.log(JSON.stringify(idx)));
  
  await mongoose.disconnect();
  process.exit(0);
}
diagnose().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
