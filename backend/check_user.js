const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const targetEmail = 'aadishbwm0@gmail.com';
  
  // Find without any filter to see if user exists at all
  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.log('USER NOT FOUND with exact email match');
    // try regex
    const allUsers = await User.find({}).select('email role status isDeleted passwordHash');
    console.log('All users in DB:', allUsers.map(u => ({
      email: u.email,
      role: u.role,
      status: u.status,
      isDeleted: u.isDeleted,
      hasPasswordHash: !!u.passwordHash
    })));
  } else {
    console.log('USER FOUND:', JSON.stringify({
      email: user.email,
      role: user.role,
      status: user.status,
      isDeleted: user.isDeleted,
      mustChangePassword: user.mustChangePassword,
      hasPasswordHash: !!user.passwordHash,
      passwordHashLength: user.passwordHash ? user.passwordHash.length : 0,
      passwordHashStart: user.passwordHash ? user.passwordHash.substring(0, 10) : 'NONE'
    }, null, 2));
  }
  
  const totalUsers = await User.countDocuments();
  console.log('Total users in DB:', totalUsers);
  
  await mongoose.disconnect();
  process.exit(0);
}
check().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
