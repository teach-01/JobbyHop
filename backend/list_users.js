const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function listAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const users = await User.find({}).select('email role status isDeleted mustChangePassword passwordHash');
  console.log('All', users.length, 'users:');
  users.forEach(u => {
    console.log({
      email: u.email,
      role: u.role,
      status: u.status,
      isDeleted: u.isDeleted,
      mustChangePassword: u.mustChangePassword,
      hasPasswordHash: !!u.passwordHash
    });
  });
  
  await mongoose.disconnect();
  process.exit(0);
}
listAll().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
