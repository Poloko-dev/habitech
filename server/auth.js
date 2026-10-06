// Token gate for the app. The PASS_TOKEN from .env is only ever read here, on the
// server – it is never sent to the browser. A correct token gets an HttpOnly session
// cookie; /api/storage refuses requests without one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const COOKIE = 'habitech_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // stay unlocked for 7 days on this browser
const MAX_FAILS = 5; // wrong tokens allowed before a cool-down
const LOCKOUT_MS = 30 * 1000;

/** Minimal .env reader (KEY=value lines, optional quotes, # comments). */
export function readEnvFile(dir) {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, '');
      out[m[1]] = v;
    }
  } catch {
    /* no .env file */
  }
  return out;
}

// Constant-time comparison (hashing first makes the lengths equal).
const sameToken = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(a)).digest(),
    crypto.createHash('sha256').update(String(b)).digest(),
  );

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

export function createAuth(passToken) {
  const token = (passToken || '').trim();
  const sessions = new Map(); // id -> expiresAt
  const attempts = new Map(); // ip -> { fails, lockedUntil }

  const isAuthed = (req) => {
    const id = parseCookies(req)[COOKIE];
    const exp = id && sessions.get(id);
    if (!exp) return false;
    if (exp < Date.now()) {
      sessions.delete(id);
      return false;
    }
    return true;
  };

  const cookie = (id, maxAgeSec) =>
    `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;

  /** Handles GET/POST/DELETE /api/auth. Returns true if it handled the request. */
  async function handle(req, res, url, readBody, send) {
    if (url !== '/api/auth') return false;
    const ip = req.socket?.remoteAddress || 'local';

    if (req.method === 'GET') {
      send(res, 200, { authenticated: isAuthed(req), configured: Boolean(token) });
    } else if (req.method === 'POST') {
      if (!token) return send(res, 503, { error: 'PASS_TOKEN is not set in .env' }), true;
      const a = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
      if (a.lockedUntil > Date.now()) {
        const wait = Math.ceil((a.lockedUntil - Date.now()) / 1000);
        return send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait }), true;
      }
      let given = '';
      try {
        given = JSON.parse(await readBody(req))?.token ?? '';
      } catch {
        /* treated as wrong token */
      }
      if (given && sameToken(given.trim(), token)) {
        attempts.delete(ip);
        const id = crypto.randomBytes(32).toString('hex');
        sessions.set(id, Date.now() + SESSION_MS);
        res.setHeader('Set-Cookie', cookie(id, SESSION_MS / 1000));
        send(res, 200, { authenticated: true });
      } else {
        a.fails += 1;
        if (a.fails >= MAX_FAILS) {
          a.fails = 0;
          a.lockedUntil = Date.now() + LOCKOUT_MS;
          attempts.set(ip, a);
          const wait = LOCKOUT_MS / 1000;
          return send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait }), true;
        }
        attempts.set(ip, a);
        send(res, 401, { error: 'That token doesn’t match.' });
      }
    } else if (req.method === 'DELETE') {
      const id = parseCookies(req)[COOKIE];
      if (id) sessions.delete(id);
      res.setHeader('Set-Cookie', cookie('', 0));
      send(res, 200, { authenticated: false });
    } else {
      res.setHeader('Allow', 'GET, POST, DELETE');
      send(res, 405, { error: 'Method not allowed' });
    }
    return true;
  }

  return { isAuthed, handle, configured: Boolean(token) };
}
