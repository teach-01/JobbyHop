const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function restore() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const targetEmail = 'aadishbwm0@gmail.com';
  
  // Find user including deleted ones
  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.log('USER NOT FOUND at all');
    await mongoose.disconnect();
    process.exit(1);
  }
  
  console.log('Current state:', {
    email: user.email,
    role: user.role,
    status: user.status,
    isDeleted: user.isDeleted
  });
  
  // Restore the account
  user.isDeleted = false;
  user.deletedAt = undefined;
  user.status = 'ACTIVE';
  await user.save();
  
  console.log('Account restored to ACTIVE. New state:', {
    email: user.email,
    role: user.role,
    status: user.status,
    isDeleted: user.isDeleted
  });
  
  await mongoose.disconnect();
  process.exit(0);
}
restore().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
