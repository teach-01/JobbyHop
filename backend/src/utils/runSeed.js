const dotenv = require('dotenv');
dotenv.config();

const { connectDB, closeDB } = require('../config/db');
const { seedDatabase } = require('./seedData');

const run = async () => {
  try {
    await connectDB();
    await seedDatabase();
    console.log('Seed process finished successfully.');
    await closeDB();
    process.exit(0);
  } catch (err) {
    console.error('Seed process failed:', err);
    process.exit(1);
  }
};

run();
