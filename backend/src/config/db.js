const dns = require('dns');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Attempts connection to MongoDB with automatic DNS fallback for Windows SRV resolution.
 * If local router/ISP DNS refuses SRV queries (querySrv ECONNREFUSED), retries with
 * reliable public DNS resolvers (8.8.8.8, 1.1.1.1) before failing.
 */
async function connectWithDnsFallback(uri, options = {}) {
  try {
    return await mongoose.connect(uri, options);
  } catch (err) {
    const isDnsError =
      err.message &&
      (err.message.includes('querySrv') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND'));

    if (isDnsError) {
      console.warn('⚠️  DNS SRV query failed with system resolver. Retrying with public DNS (8.8.8.8, 1.1.1.1)...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
        return await mongoose.connect(uri, options);
      } catch (retryErr) {
        throw retryErr;
      }
    }
    throw err;
  }
}

const connectDB = async () => {
  const hasConfiguredUri = process.env.MONGODB_URI && process.env.MONGODB_URI.trim() !== '';

  // 1. If explicit MONGODB_URI is provided, connect to it (Atlas or custom)
  if (hasConfiguredUri) {
    try {
      const conn = await connectWithDnsFallback(process.env.MONGODB_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB Connection Error: ${error.message}`);
      // SAFETY RULE: Do NOT silently start an in-memory database when the user
      // has explicitly configured MONGODB_URI. This prevents running against
      // an ephemeral database and auto-seeding dummy accounts.
      if (process.env.ALLOW_IN_MEMORY_FALLBACK === 'true') {
        console.warn('⚠️  ALLOW_IN_MEMORY_FALLBACK is enabled. Falling back to in-memory server...');
      } else {
        console.error('\n❌ Could not connect to configured MongoDB Atlas database.');
        console.error('Please verify your internet connection, Atlas IP whitelist, and credentials.');
        console.error('Server startup aborted to protect database integrity.\n');
        process.exit(1);
      }
    }
  }

  // 2. In-memory database (only used when MONGODB_URI is not provided or explicitly allowed)
  console.log('No MONGODB_URI provided. Starting in-memory MongoDB Server for development/tests...');
  try {
    mongoServer = await MongoMemoryServer.create();
    const fallbackUri = mongoServer.getUri();
    const conn = await mongoose.connect(fallbackUri);
    console.log(`In-memory MongoDB started and connected at: ${fallbackUri}`);
    return conn;
  } catch (err) {
    console.error(`Failed to start in-memory MongoDB Server: ${err.message}`);
    process.exit(1);
  }
};

const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = { connectDB, closeDB, connectWithDnsFallback };
