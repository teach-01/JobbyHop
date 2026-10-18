const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI;

    if (!mongoUri || mongoUri.trim() === '') {
      console.log('No MONGODB_URI provided. Starting in-memory MongoDB Server...');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`In-memory MongoDB started at: ${mongoUri}`);
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // If external mongo connection fails, fallback to memory server
    if (!mongoServer) {
      console.log('Attempting fallback to in-memory MongoDB Server...');
      try {
        mongoServer = await MongoMemoryServer.create();
        const fallbackUri = mongoServer.getUri();
        const conn = await mongoose.connect(fallbackUri);
        console.log(`Fallback in-memory MongoDB Connected: ${conn.connection.host}`);
        return conn;
      } catch (fallbackError) {
        console.error(`Fallback Mongo Server failed: ${fallbackError.message}`);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
};

const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = { connectDB, closeDB };
