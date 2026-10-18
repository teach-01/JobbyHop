const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const envConfig = dotenv.parse(fs.readFileSync('./.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobbyhop';
console.log('Database URI:', mongoUri);

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB:', mongoose.connection.name);
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  const beforeCounts = {};
  for (const name of collectionNames) {
    beforeCounts[name] = await db.collection(name).countDocuments();
  }
  
  console.log('--- BEFORE COUNTS ---');
  console.table(beforeCounts);

  // Keep only admin and operations
  const usersCol = db.collection('users');
  const admins = await usersCol.find({ email: 'supportjobbyhop@gmail.com' }).toArray();
  const ops = await usersCol.find({ email: 'operations@jobbyhop.com' }).toArray();
  
  console.log('Found admins:', admins.length, 'ops:', ops.length);
  
  const keepIds = [...admins.map(u => u._id), ...ops.map(u => u._id)];
  
  const deletedCounts = {};
  
  for (const name of collectionNames) {
    if (name === 'users') {
      const res = await db.collection('users').deleteMany({ _id: { $nin: keepIds } });
      deletedCounts['users'] = res.deletedCount;
    } else {
      const res = await db.collection(name).deleteMany({});
      deletedCounts[name] = res.deletedCount;
    }
  }
  
  console.log('--- DELETED COUNTS ---');
  console.table(deletedCounts);
  
  const afterCounts = {};
  for (const name of collectionNames) {
    afterCounts[name] = await db.collection(name).countDocuments();
  }
  
  console.log('--- AFTER COUNTS ---');
  console.table(afterCounts);
  
  await mongoose.disconnect();
}

run().catch(console.error);
