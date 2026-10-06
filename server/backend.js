// Picks the backend for local runs (Vite dev server and `npm start`):
// MongoDB when MONGODB_URI (or MONGO_DB) is set, otherwise ./storage.json.
import { createApi, fileStore } from './storageApi.js';
import { createAuth, memoryAttempts } from './auth.js';
import { mongoStore, mongoAttempts, mongoConfig } from './mongo.js';

export function createLocalApi(env) {
  const opts = mongoConfig(env);
  const useMongo = Boolean(opts.uri);
  const auth = createAuth(env.PASS_TOKEN, useMongo ? mongoAttempts(opts) : memoryAttempts());
  return {
    api: createApi(auth, useMongo ? mongoStore(opts) : fileStore),
    backend: useMongo ? `MongoDB (${opts.dbName})` : 'storage.json',
    configured: auth.configured,
  };
}
