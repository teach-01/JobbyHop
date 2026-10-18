const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

/**
 * seedDatabase — Ensures the Admin account exists.
 *
 * This function is called by server.js ONLY when User.countDocuments() === 0.
 * It creates the initial Admin user so the system can be used.
 *
 * It does NOT create mock Recruiters, Workers, Jobs, Applications, etc.
 * All non-Admin data must come from real user registration and real workflows.
 */
const seedDatabase = async () => {
  try {
    // Only create Admin if none exists
    const existingAdmin = await User.findOne({ role: ROLES.ADMIN });
    if (existingAdmin) {
      console.log(`✅ Admin account already exists: ${existingAdmin.email}`);
    } else {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);

      await User.create({
        email: 'supportjobbyhop@gmail.com',
        phone: '+91 98765 00000',
        passwordHash: adminPasswordHash,
        role: ROLES.ADMIN,
        profileCompleted: true,
      });

      console.log('✅ Created Admin user: supportjobbyhop@gmail.com / admin123');
      console.log('ℹ️  No mock data created. Register real Recruiters and Workers through the app.');
    }
    // Create Operations if none exists
    const existingOperations = await User.findOne({ email: 'operations@jobbyhop.com' });
    if (!existingOperations) {
      const operationsPasswordHash = await bcrypt.hash('Operations@123', 10);
      await User.create({
        email: 'operations@jobbyhop.com',
        phone: '+91 98765 00001',
        passwordHash: operationsPasswordHash,
        role: ROLES.OPERATIONS,
        profileCompleted: true,
      });
      console.log('✅ Created Operations user: operations@jobbyhop.com / Operations@123');
    } else {
      console.log(`✅ Operations account already exists: ${existingOperations.email}`);
      // Ensure role is correct if it was somehow created differently
      if (existingOperations.role !== ROLES.OPERATIONS) {
        existingOperations.role = ROLES.OPERATIONS;
        await existingOperations.save();
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

module.exports = { seedDatabase };
