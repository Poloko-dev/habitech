// Reads and writes ./storage.json (project root) for the habit tracker.
// Exposed as GET /api/storage and PUT /api/storage, used by both the Vite dev
// server (vite.config.js) and the standalone production server (server.js).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORAGE_FILE = path.join(ROOT, 'storage.json');
const MAX_BODY_BYTES = 10 * 1024 * 1024;

const EMPTY = { version: 1, habits: [], logs: {}, notes: {}, pomodoro: { settings: {}, active: null, sessions: [] } };

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function normalize(data) {
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

async function readStorage() {
  try {
    const raw = await fs.readFile(STORAGE_FILE, 'utf8');
    return normalize(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeStorage(EMPTY);
      return { ...EMPTY };
    }
    throw err;
  }
}

// Serialize writes and write atomically (temp file + rename) so a crash
// mid-write never leaves a truncated storage.json behind.
let writeChain = Promise.resolve();
function writeStorage(data) {
  const run = async () => {
    const tmp = `${STORAGE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(normalize(data), null, 2), 'utf8');
    await fs.rename(tmp, STORAGE_FILE);
  };
  writeChain = writeChain.then(run, run);
  return writeChain;
}

function readBody(req) {
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

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Connect-style middleware for /api/auth and /api/storage. Storage requires an
 * unlocked session (see auth.js). Calls next() for everything else.
 */
export function createApi(auth) {
  return function apiMiddleware(req, res, next) {
    const url = decodeURIComponent((req.url || '').split('?')[0]);

    // The data file must only be reachable through the authenticated API – the Vite
    // dev server would otherwise serve it as a static file.
    if (/^\/storage\.json/i.test(url)) return send(res, 404, { error: 'Not found' });

    if (url === '/api/auth') {
      auth.handle(req, res, url, readBody, send).catch((err) => send(res, 500, { error: err.message }));
      return undefined;
    }
    if (url !== '/api/storage') return next ? next() : send(res, 404, { error: 'Not found' });
    if (!auth.isAuthed(req)) return send(res, 401, { error: 'Locked' });
    return storageRoute(req, res);
  };
}

function storageRoute(req, res) {
  (async () => {
    if (req.method === 'GET') {
      send(res, 200, await readStorage());
    } else if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return send(res, 400, { error: 'Invalid JSON' });
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
        return send(res, 400, { error: 'Expected { habits: [], logs: {}, notes: {} }' });
      }
      await writeStorage(parsed);
      send(res, 200, { ok: true, savedAt: new Date().toISOString() });
    } else {
      res.setHeader('Allow', 'GET, PUT, POST');
      send(res, 405, { error: 'Method not allowed' });
    }
  })().catch((err) => send(res, err.status || 500, { error: err.message }));
}

export { ROOT };
