import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  // For local development, we allow building without database
  // But warn in development
  if (process.env.NODE_ENV === "development") {
    console.warn("MONGODB_URI is not defined. App will work without database features.");
  }
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<mongoose.Mongoose | null> {
  // Return null if no MONGODB_URI
  if (!MONGODB_URI) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    if (cached.promise) {
      cached.conn = await cached.promise;
    }
  } catch (e) {
    console.error("MongoDB connection error:", e);
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;