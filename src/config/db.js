import mongoose from "mongoose";
import env from "./env.js";

export async function connectDatabase(uri = env.MONGODB_URI) {
  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    return mongoose.connection.asPromise();
  }

  return mongoose.connect(uri);
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
