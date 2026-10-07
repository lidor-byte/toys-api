const mongoose = require('mongoose');

let connectionPromise;

function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to your environment variables.');
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  }
  return connectionPromise;
}

module.exports = { connectDatabase };
