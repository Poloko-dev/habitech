// Vercel function: GET/POST/DELETE /api/auth
// Needs MONGODB_URI (or MONGO_DB). PASS_TOKEN is optional: without it, the token is
// created in the app on first launch and stored hashed in MongoDB.
import { createAuth } from '../server/auth.js';
import { mongoAttempts, mongoTokenStore } from '../server/mongo.js';
import { readBody, send } from '../server/storageApi.js';

export default async function handler(req, res) {
  try {
    const auth = createAuth({ envToken: process.env.PASS_TOKEN, tokenStore: mongoTokenStore(), attempts: mongoAttempts() });
    await auth.handle(req, res, readBody, send);
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
}
