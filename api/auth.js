// Vercel function: GET/POST/DELETE /api/auth
// Needs PASS_TOKEN and MONGODB_URI in the Vercel project's environment variables.
import { createAuth } from '../server/auth.js';
import { mongoAttempts } from '../server/mongo.js';
import { readBody, send } from '../server/storageApi.js';

export default async function handler(req, res) {
  try {
    await createAuth(process.env.PASS_TOKEN, mongoAttempts()).handle(req, res, readBody, send);
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
}
