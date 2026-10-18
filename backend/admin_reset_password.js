/**
 * Admin password reset tool.
 * Usage: node admin_reset_password.js <email> <newPassword>
 * Example: node admin_reset_password.js aadishbwm0@gmail.com NewPassword123
 */
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: node admin_reset_password.js <email> <newPassword>');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find the active account for this email
  const user = await User.findOne({ email: email.toLowerCase().trim(), isDeleted: { $ne: true } });

  if (!user) {
    console.error(`No active account found for email: ${email}`);
    
    // Show what we do have
    const allWithEmail = await User.find({ email: email.toLowerCase().trim() });
    if (allWithEmail.length > 0) {
      console.log('Found deleted/deactivated accounts:');
      allWithEmail.forEach(u => console.log({ role: u.role, status: u.status, isDeleted: u.isDeleted }));
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Found user:', { email: user.email, role: user.role, status: user.status });

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  user.mustChangePassword = false;
  await user.save();

  console.log(`\n✅ Password reset successfully for ${email} (${user.role} account)`);
  console.log(`   New password: ${newPassword}`);
  console.log(`   You can now log in at http://localhost:5173/login`);

  await mongoose.disconnect();
  process.exit(0);
}

resetPassword().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
