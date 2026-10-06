// Vercel function: GET/PUT/POST /api/storage (requires an unlocked session)
// Needs PASS_TOKEN and MONGODB_URI in the Vercel project's environment variables.
import { createAuth } from '../server/auth.js';
import { mongoStore } from '../server/mongo.js';
import { handleStorage, send } from '../server/storageApi.js';

export default async function handler(req, res) {
  try {
    if (!createAuth(process.env.PASS_TOKEN).isAuthed(req)) return send(res, 401, { error: 'Locked' });
    await handleStorage(req, res, mongoStore());
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
}
