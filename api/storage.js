// Vercel function: GET/PUT/POST /api/storage (requires an unlocked session)
import { createAuth } from '../server/auth.js';
import { mongoStore, mongoTokenStore } from '../server/mongo.js';
import { handleStorage, send } from '../server/storageApi.js';

export default async function handler(req, res) {
  try {
    const auth = createAuth({ envToken: process.env.PASS_TOKEN, tokenStore: mongoTokenStore() });
    if (!(await auth.isAuthed(req))) return send(res, 401, { error: 'Locked' });
    await handleStorage(req, res, mongoStore());
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
}
