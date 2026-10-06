// Token gate for the app. PASS_TOKEN is only ever read on the server – it is never
// sent to the browser. A correct token gets a signed, HttpOnly session cookie.
//
// Sessions are stateless (an expiry time signed with a key derived from PASS_TOKEN),
// so they work on serverless hosts like Vercel where memory isn't kept between
// requests. Changing PASS_TOKEN signs everyone out.
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

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Constant-time comparison (hashing first makes the lengths equal).
const sameToken = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

/** In-process attempt counter (local dev / single server). */
export function memoryAttempts() {
  const map = new Map();
  return {
    get: async (ip) => map.get(ip) || { fails: 0, lockedUntil: 0 },
    set: async (ip, rec) => void map.set(ip, rec),
    clear: async (ip) => void map.delete(ip),
  };
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'local';

const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket?.encrypted);

/**
 * @param passToken  value of PASS_TOKEN
 * @param attempts   { get, set, clear } store for wrong-token counting
 */
export function createAuth(passToken, attempts = memoryAttempts()) {
  const token = (passToken || '').trim();
  const key = sha256(`habitech-session:${token}`);
  const sign = (exp) => crypto.createHmac('sha256', key).update(String(exp)).digest('base64url');

  const isAuthed = (req) => {
    if (!token) return false;
    const [exp, sig] = (parseCookies(req)[COOKIE] || '').split('.');
    if (!exp || !sig || !(Number(exp) > Date.now())) return false;
    const expected = Buffer.from(sign(exp));
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  };

  const cookie = (req, value, maxAgeSec) =>
    `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${isHttps(req) ? '; Secure' : ''}`;

  /** Handles GET/POST/DELETE on /api/auth. */
  async function handle(req, res, readBody, send) {
    if (req.method === 'GET') {
      return send(res, 200, { authenticated: isAuthed(req), configured: Boolean(token) });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return send(res, 200, { authenticated: false });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return send(res, 405, { error: 'Method not allowed' });
    }
    if (!token) return send(res, 503, { error: 'PASS_TOKEN is not set on the server' });

    const ip = clientIp(req);
    const a = await attempts.get(ip);
    if (a.lockedUntil > Date.now()) {
      const wait = Math.ceil((a.lockedUntil - Date.now()) / 1000);
      return send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait });
    }

    let given = '';
    try {
      given = JSON.parse(await readBody(req))?.token ?? '';
    } catch {
      /* treated as a wrong token */
    }

    if (given && sameToken(String(given).trim(), token)) {
      await attempts.clear(ip);
      const exp = Date.now() + SESSION_MS;
      res.setHeader('Set-Cookie', cookie(req, `${exp}.${sign(exp)}`, SESSION_MS / 1000));
      return send(res, 200, { authenticated: true });
    }

    const fails = a.fails + 1;
    if (fails >= MAX_FAILS) {
      await attempts.set(ip, { fails: 0, lockedUntil: Date.now() + LOCKOUT_MS });
      const wait = LOCKOUT_MS / 1000;
      return send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait });
    }
    await attempts.set(ip, { fails, lockedUntil: 0 });
    return send(res, 401, { error: 'That token doesn’t match.' });
  }

  return { isAuthed, handle, configured: Boolean(token) };
}
