// Token gate for the app. The token is only ever checked on the server.
//
// Where the token comes from:
//   • PASS_TOKEN environment variable, if set (takes priority), or
//   • a token created in the app on first launch, stored hashed (scrypt) in the
//     token store – MongoDB `settings` collection, or a local file without Mongo.
//
// A correct token gets a signed, HttpOnly session cookie. Sessions are stateless
// (an expiry time signed with a secret key), so they also work on serverless hosts.
// Changing the token rotates the key, which signs every browser out.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const COOKIE = 'habitech_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // stay unlocked for 7 days on this browser
const MAX_FAILS = 5; // wrong tokens allowed before a cool-down
const LOCKOUT_MS = 30 * 1000;
const MIN_TOKEN = 8;
const MAX_TOKEN = 200;
const CACHE_MS = 5000; // how long the stored token record is cached in memory

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
const sameToken = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

async function hashToken(token, salt = crypto.randomBytes(16).toString('base64')) {
  const hash = (await scrypt(token, salt, 64)).toString('base64');
  return { hash, salt };
}

async function matchesHash(token, rec) {
  const { hash } = await hashToken(token, rec.salt);
  const a = Buffer.from(hash, 'base64');
  const b = Buffer.from(rec.hash, 'base64');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'local';

const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket?.encrypted);

// ---------- stores ----------

/** In-process wrong-attempt counter (single local server). */
export function memoryAttempts() {
  const map = new Map();
  return {
    get: async (ip) => map.get(ip) || { fails: 0, lockedUntil: 0 },
    set: async (ip, rec) => void map.set(ip, rec),
    clear: async (ip) => void map.delete(ip),
  };
}

/** Token record in a local JSON file (used when MongoDB isn't configured). */
export function fileTokenStore(file) {
  return {
    async get() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async create(rec) {
      try {
        fs.writeFileSync(file, JSON.stringify(rec, null, 2), { flag: 'wx' }); // fails if it exists
      } catch (err) {
        if (err.code === 'EEXIST') throw Object.assign(new Error('A token already exists'), { status: 409 });
        throw err;
      }
    },
    async update(rec) {
      fs.writeFileSync(file, JSON.stringify(rec, null, 2));
    },
  };
}

// ---------- auth ----------

const tokenError = (t) =>
  t.length < MIN_TOKEN ? `Use at least ${MIN_TOKEN} characters.` : t.length > MAX_TOKEN ? 'That token is too long.' : '';

/**
 * @param {object} o
 * @param {string} [o.envToken]   PASS_TOKEN – if set, it is the token and can't be changed in the app
 * @param {object} o.tokenStore   { get, create, update } for an in-app token
 * @param {object} [o.attempts]   { get, set, clear } wrong-token counter
 */
export function createAuth({ envToken, tokenStore, attempts = memoryAttempts() }) {
  const fixed = (envToken || '').trim();
  let cache = { at: 0, rec: null };

  async function secrets() {
    if (fixed) {
      return { mode: 'env', key: sha256(`habitech-session:${fixed}`), verify: async (t) => sameToken(t, fixed) };
    }
    if (Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), rec: await tokenStore.get() };
    const rec = cache.rec;
    if (!rec) return { mode: 'setup' };
    return { mode: 'stored', rec, key: Buffer.from(rec.sessionKey, 'base64'), verify: (t) => matchesHash(t, rec) };
  }
  const forget = () => (cache = { at: 0, rec: null });

  const sign = (key, exp) => crypto.createHmac('sha256', key).update(String(exp)).digest('base64url');

  async function isAuthed(req) {
    const s = await secrets();
    if (!s.key) return false;
    const [exp, sig] = (parseCookies(req)[COOKIE] || '').split('.');
    if (!exp || !sig || !(Number(exp) > Date.now())) return false;
    const expected = Buffer.from(sign(s.key, exp));
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  }

  const cookie = (req, value, maxAgeSec) =>
    `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${isHttps(req) ? '; Secure' : ''}`;
  const startSession = (req, res, key) => {
    const exp = Date.now() + SESSION_MS;
    res.setHeader('Set-Cookie', cookie(req, `${exp}.${sign(key, exp)}`, SESSION_MS / 1000));
  };

  /** Runs `check` under the wrong-attempt limit. Returns true if the token was right. */
  async function limited(req, res, send, check) {
    const ip = clientIp(req);
    const a = await attempts.get(ip);
    if (a.lockedUntil > Date.now()) {
      const wait = Math.ceil((a.lockedUntil - Date.now()) / 1000);
      send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait });
      return false;
    }
    if (await check()) {
      await attempts.clear(ip);
      return true;
    }
    const fails = a.fails + 1;
    if (fails >= MAX_FAILS) {
      await attempts.set(ip, { fails: 0, lockedUntil: Date.now() + LOCKOUT_MS });
      const wait = LOCKOUT_MS / 1000;
      send(res, 429, { error: `Too many attempts. Try again in ${wait}s.`, retryAfter: wait });
    } else {
      await attempts.set(ip, { fails, lockedUntil: 0 });
      send(res, 401, { error: 'That token doesn’t match.' });
    }
    return false;
  }

  /**
   * /api/auth
   *   GET                                  → { authenticated, configured, setupRequired, source }
   *   POST { token }                       → unlock
   *   POST { action: 'setup', token }      → create the first token (only when none exists)
   *   POST { action: 'change', current, token } → change the stored token (signs others out)
   *   DELETE                               → lock this browser
   */
  async function handle(req, res, readBody, send) {
    if (req.method === 'GET') {
      const s = await secrets();
      return send(res, 200, {
        authenticated: await isAuthed(req),
        configured: s.mode !== 'setup',
        setupRequired: s.mode === 'setup',
        source: s.mode, // 'env' | 'stored' | 'setup'
      });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return send(res, 200, { authenticated: false });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return send(res, 405, { error: 'Method not allowed' });
    }

    let body = {};
    try {
      body = JSON.parse(await readBody(req)) || {};
    } catch {
      /* treated as empty */
    }
    const token = String(body.token ?? '').trim();
    const s = await secrets();

    if (body.action === 'setup') {
      if (s.mode !== 'setup') return send(res, 409, { error: 'An access token already exists. Unlock with it instead.' });
      const problem = tokenError(token);
      if (problem) return send(res, 400, { error: problem });
      const sessionKey = crypto.randomBytes(32).toString('base64');
      await tokenStore.create({ ...(await hashToken(token)), sessionKey, createdAt: new Date().toISOString() });
      forget();
      startSession(req, res, Buffer.from(sessionKey, 'base64'));
      return send(res, 200, { authenticated: true });
    }

    if (body.action === 'change') {
      if (s.mode === 'env') return send(res, 400, { error: 'The token is set by PASS_TOKEN on the server – change it there.' });
      if (s.mode !== 'stored') return send(res, 400, { error: 'No token has been created yet.' });
      if (!(await isAuthed(req))) return send(res, 401, { error: 'Locked' });
      const problem = tokenError(token);
      if (problem) return send(res, 400, { error: problem });
      const ok = await limited(req, res, send, () => s.verify(String(body.current ?? '').trim()));
      if (!ok) return undefined;
      const sessionKey = crypto.randomBytes(32).toString('base64');
      await tokenStore.update({ ...(await hashToken(token)), sessionKey, createdAt: s.rec.createdAt, updatedAt: new Date().toISOString() });
      forget();
      startSession(req, res, Buffer.from(sessionKey, 'base64')); // keep this browser unlocked
      return send(res, 200, { ok: true });
    }

    // Unlock
    if (s.mode === 'setup') return send(res, 409, { error: 'No access token yet – create one first.', setupRequired: true });
    const ok = await limited(req, res, send, () => (token ? s.verify(token) : false));
    if (!ok) return undefined;
    startSession(req, res, s.key);
    return send(res, 200, { authenticated: true });
  }

  return { isAuthed, handle };
}
