// Picks the backend for local runs (Vite dev server and `npm start`):
// MongoDB when MONGO_DB / MONGODB_URI is set, otherwise ./storage.json.
import path from 'node:path';
import { createApi, fileStore, ROOT } from './storageApi.js';
import { createAuth, memoryAttempts, fileTokenStore } from './auth.js';
import { mongoStore, mongoAttempts, mongoTokenStore, mongoConfig } from './mongo.js';

export function createLocalApi(env) {
  const opts = mongoConfig(env);
  const useMongo = Boolean(opts.uri);
  const auth = createAuth({
    envToken: env.PASS_TOKEN,
    tokenStore: useMongo ? mongoTokenStore(opts) : fileTokenStore(path.join(ROOT, '.habitech-auth.json')),
    attempts: useMongo ? mongoAttempts(opts) : memoryAttempts(),
  });
  return {
    api: createApi(auth, useMongo ? mongoStore(opts) : fileStore),
    backend: useMongo ? `MongoDB (${opts.dbName})` : 'storage.json',
  };
}
