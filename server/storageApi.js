// Storage API for the habit tracker: GET/PUT /api/storage (+ /api/auth).
// The same handlers run in three places:
//   • Vite dev server (vite.config.js) and `npm start` (server/server.js) via createApi()
//   • Vercel functions (api/auth.js, api/storage.js)
// Data lives in ./storage.json locally, or in MongoDB when MONGODB_URI is set.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORAGE_FILE = path.join(ROOT, 'storage.json');
const MAX_BODY_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

export const EMPTY = { version: 1, habits: [], logs: {}, notes: {}, pomodoro: { settings: {}, active: null, sessions: [] } };

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function normalize(data) {
  const p = isObj(data?.pomodoro) ? data.pomodoro : {};
  return {
    version: 1,
    habits: Array.isArray(data?.habits) ? data.habits : [],
    logs: isObj(data?.logs) ? data.logs : {},
    notes: isObj(data?.notes) ? data.notes : {},
    habitNotes: isObj(data?.habitNotes) ? data.habitNotes : {}, // { date: { habitId: text } }
    pomodoro: {
      settings: isObj(p.settings) ? p.settings : {},
      active: isObj(p.active) ? p.active : null,
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
    },
    prefs: isObj(data?.prefs) ? data.prefs : {},
    demo: isObj(data?.demo) ? data.demo : null, // set while sample data is loaded
  };
}

// ---------- file store (local) ----------

let writeChain = Promise.resolve();

export const fileStore = {
  async read() {
    try {
      return normalize(JSON.parse(await fs.readFile(STORAGE_FILE, 'utf8')));
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fileStore.write(EMPTY);
        return normalize(EMPTY);
      }
      throw err;
    }
  },
  // Serialized, atomic writes (temp file + rename) so a crash never truncates storage.json.
  write(data) {
    const run = async () => {
      const tmp = `${STORAGE_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(normalize(data), null, 2), 'utf8');
      await fs.rename(tmp, STORAGE_FILE);
    };
    writeChain = writeChain.then(run, run);
    return writeChain;
  },
};

// ---------- HTTP helpers ----------

/** Request body as a string. Vercel pre-parses bodies into req.body; plain Node streams them. */
export function readBody(req) {
  if (req.body !== undefined) {
    const b = req.body;
    if (b == null) return Promise.resolve('');
    if (typeof b === 'string') return Promise.resolve(b);
    if (Buffer.isBuffer(b)) return Promise.resolve(b.toString('utf8'));
    return Promise.resolve(JSON.stringify(b));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// ---------- handlers ----------

/** GET/PUT/POST /api/storage – caller has already checked the session. */
export async function handleStorage(req, res, store) {
  if (req.method === 'GET') return send(res, 200, await store.read());
  if (req.method === 'PUT' || req.method === 'POST') {
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch (err) {
      return send(res, err.status || 400, { error: err.status ? err.message : 'Invalid JSON' });
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
      return send(res, 400, { error: 'Expected { habits: [], logs: {}, notes: {} }' });
    }
    await store.write(parsed);
    return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }
  res.setHeader('Allow', 'GET, PUT, POST');
  return send(res, 405, { error: 'Method not allowed' });
}

const fail = (res) => (err) => send(res, err.status || 500, { error: err.message || 'Server error' });

/** Connect-style middleware (local dev & `npm start`). Calls next() for everything else. */
export function createApi(auth, store = fileStore) {
  return function apiMiddleware(req, res, next) {
    const url = decodeURIComponent((req.url || '').split('?')[0]);

    // Data and token files must only be reachable through the authenticated API – the
    // Vite dev server would otherwise serve them as static files.
    if (/^\/(storage\.json|\.habitech-auth)/i.test(url)) return send(res, 404, { error: 'Not found' });

    if (url === '/api/auth') return void auth.handle(req, res, readBody, send).catch(fail(res));
    if (url !== '/api/storage') return next ? next() : send(res, 404, { error: 'Not found' });
    return void auth
      .isAuthed(req)
      .then((ok) => (ok ? handleStorage(req, res, store) : send(res, 401, { error: 'Locked' })))
      .catch(fail(res));
  };
}
