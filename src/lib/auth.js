// Client side of the token gate. The token itself is only checked on the server.

export const LOCKED_EVENT = 'habitech:locked';

export async function authStatus() {
  let r;
  try {
    r = await fetch('/api/auth', { cache: 'no-store' });
  } catch {
    throw new Error('Can’t reach the server. Is it running?');
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `Auth check failed (${r.status})`);
  }
  return r.json(); // { authenticated, configured, setupRequired, source }
}

/** Returns { ok } or { ok: false, error, retryAfter }. */
export async function unlock(token) {
  const r = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const body = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: body.error || `Unlock failed (${r.status})`, retryAfter: body.retryAfter };
}

/** Save anything pending, end the session, and show the lock screen. */
export async function lockApp(flush) {
  try {
    await flush?.();
  } finally {
    await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    window.dispatchEvent(new Event(LOCKED_EVENT));
  }
}

/** Called when the server answers 401 (e.g. the session expired). */
export const notifyLocked = () => window.dispatchEvent(new Event(LOCKED_EVENT));

async function postAuth(payload) {
  const r = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: body.error || `Request failed (${r.status})`, retryAfter: body.retryAfter };
}

/** First launch: create the access token (stored hashed on the server). */
export const setupToken = (token) => postAuth({ action: 'setup', token });

/** Change the stored access token. Other browsers are signed out. */
export const changeToken = (current, token) => postAuth({ action: 'change', current, token });
