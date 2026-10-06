// MongoDB backing for the API (used on Vercel, and locally when MONGODB_URI is set).
//   habitech.storage        – one document { _id: 'storage', data, updatedAt }
//   habitech.auth_attempts  – wrong-token counters per IP (expire automatically)
import { MongoClient } from 'mongodb';
import { normalize, EMPTY } from './storageApi.js';

// Reuse one connection across warm serverless invocations.
const cache = globalThis.__habitechMongo || (globalThis.__habitechMongo = {});

export function getDb(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'habitech') {
  if (!uri) {
    return Promise.reject(Object.assign(new Error('MONGODB_URI is not set on the server'), { status: 503 }));
  }
  if (!cache.db) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    cache.db = client
      .connect()
      .then(async (c) => {
        const db = c.db(dbName);
        await db.collection('auth_attempts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
        return db;
      })
      .catch((err) => {
        cache.db = null; // retry on the next request
        throw Object.assign(new Error(`Can’t reach MongoDB: ${err.message}`), { status: 503 });
      });
  }
  return cache.db;
}

export function mongoStore(opts = {}) {
  const col = async () => (await getDb(opts.uri, opts.dbName)).collection('storage');
  return {
    async read() {
      const doc = await (await col()).findOne({ _id: 'storage' });
      return normalize(doc?.data ?? EMPTY);
    },
    async write(data) {
      await (await col()).replaceOne(
        { _id: 'storage' },
        { _id: 'storage', data: normalize(data), updatedAt: new Date() },
        { upsert: true },
      );
    },
  };
}

export function mongoAttempts(opts = {}) {
  const col = async () => (await getDb(opts.uri, opts.dbName)).collection('auth_attempts');
  const empty = { fails: 0, lockedUntil: 0 };
  return {
    async get(ip) {
      const doc = await (await col()).findOne({ _id: ip });
      return doc ? { fails: doc.fails, lockedUntil: doc.lockedUntil } : empty;
    },
    async set(ip, rec) {
      await (await col()).updateOne(
        { _id: ip },
        { $set: { ...rec, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } },
        { upsert: true },
      );
    },
    async clear(ip) {
      await (await col()).deleteOne({ _id: ip });
    },
  };
}
