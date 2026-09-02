import mongoose from "mongoose";

const globalAny = global;
if (!globalAny.__mongooseCache) {
  globalAny.__mongooseCache = { conn: null, promise: null };
}

const cached = globalAny.__mongooseCache;

export default function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI).then((mongooseInstance) => {
      cached.conn = mongooseInstance;
      return mongooseInstance;
    });
  }

  return cached.promise;
}