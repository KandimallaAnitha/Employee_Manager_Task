const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error(" MONGO_URI not found in .env file");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(" MongoDB Connected");
  } catch (err) {
    console.error(" MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
