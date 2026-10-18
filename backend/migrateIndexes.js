require('dotenv').config();
const mongoose = require('mongoose');

async function migrateIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // 1. Normalize deleted accounts: ensure isDeleted: true accounts have status: 'DELETED'
    const deletedRes = await collection.updateMany(
      { isDeleted: true },
      { $set: { status: 'DELETED' } }
    );
    console.log(`Normalized ${deletedRes.modifiedCount} soft-deleted users to status 'DELETED'`);

    // 2. Normalize status === 'DELETED' accounts to have isDeleted: true
    const statusDeletedRes = await collection.updateMany(
      { status: 'DELETED' },
      { $set: { isDeleted: true } }
    );
    console.log(`Normalized ${statusDeletedRes.modifiedCount} 'DELETED' status users to isDeleted: true`);

    // 3. Normalize all remaining non-deleted users to have isDeleted: false
    const activeRes = await collection.updateMany(
      { isDeleted: { $ne: true } },
      { $set: { isDeleted: false } }
    );
    console.log(`Normalized ${activeRes.modifiedCount} active/suspended/blocked users to isDeleted: false`);

    // 4. Get current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop existing indexes to recreate cleanly
    if (indexes.some(i => i.name === 'email_1')) {
      await collection.dropIndex('email_1');
      console.log('Dropped index email_1');
    }
    if (indexes.some(i => i.name === 'phone_1')) {
      await collection.dropIndex('phone_1');
      console.log('Dropped index phone_1');
    }
    if (indexes.some(i => i.name === 'email_partial_unique')) {
      await collection.dropIndex('email_partial_unique');
      console.log('Dropped index email_partial_unique');
    }
    if (indexes.some(i => i.name === 'phone_partial_unique')) {
      await collection.dropIndex('phone_partial_unique');
      console.log('Dropped index phone_partial_unique');
    }

    // 5. Create new partial unique indexes
    await collection.createIndex(
      { email: 1 },
      { 
        unique: true, 
        name: 'email_partial_unique',
        partialFilterExpression: { isDeleted: false }
      }
    );
    console.log('Created partial unique index for email');

    await collection.createIndex(
      { phone: 1 },
      { 
        unique: true, 
        name: 'phone_partial_unique',
        partialFilterExpression: { isDeleted: false, phone: { $gt: '' } }
      }
    );
    console.log('Created partial unique index for phone');

    console.log('Index migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

migrateIndexes();
