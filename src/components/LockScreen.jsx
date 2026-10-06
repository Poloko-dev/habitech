import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { unlock } from '../lib/auth.js';
import { formatLong, todayKey } from '../lib/dates.js';

/**
 * Shown until the correct PASS_TOKEN is entered. Behind the form is a blurred
 * mock-up of the Today page – no real data is loaded while locked.
 */
export function LockScreen({ configured, onUnlocked }) {
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const input = useRef(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token.trim() || busy || wait > 0) return;
    setBusy(true);
    setError('');
    const res = await unlock(token).catch(() => ({ ok: false, error: 'Can’t reach the server. Is it running?' }));
    setBusy(false);
    if (res.ok) return onUnlocked();
    setError(res.error);
    if (res.retryAfter) setWait(res.retryAfter);
    setToken('');
    input.current?.focus();
  };

  return (
    <div className="lock">
      <MockToday />

      <div className="lock-overlay">
        <form className="lock-card" onSubmit={submit} aria-labelledby="lock-title">
          <div className="lock-icon"><Icon name="lock" size={24} /></div>
          <h1 id="lock-title">Habitech is locked</h1>
          <p className="muted">Enter your access token to continue.</p>

          {configured ? (
            <>
              <div className="field">
                <label htmlFor="lock-token" className="sr-only">Access token</label>
                <div className="token-input">
                  <input id="lock-token" ref={input} className="input" type={show ? 'text' : 'password'}
                    autoComplete="current-password" placeholder="Access token" value={token}
                    onChange={(e) => setToken(e.target.value)} disabled={wait > 0}
                    aria-invalid={Boolean(error)} aria-describedby={error ? 'lock-error' : undefined} />
                  <button type="button" className="token-eye" onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Hide token' : 'Show token'} title={show ? 'Hide token' : 'Show token'}>
                    <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </div>
              </div>
              {(error || wait > 0) && (
                <p id="lock-error" className="error-text" role="alert">
                  {wait > 0 ? `Too many attempts. Try again in ${wait}s.` : error}
                </p>
              )}
              <button type="submit" className="btn btn-primary lock-submit" disabled={busy || wait > 0 || !token.trim()}>
                <Icon name="lock" size={16} />{busy ? 'Checking…' : 'Unlock'}
              </button>
            </>
          ) : (
            <p className="lock-warn" role="alert">
              No <code>PASS_TOKEN</code> is set. Add <code>PASS_TOKEN=your-token</code> to the <code>.env</code> file
              in the project folder, then restart the server.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

/** Decorative stand-in for the Today page (no user data). */
function MockToday() {
  const bars = [72, 54, 81, 40, 63];
  return (
    <div className="app lock-mock" aria-hidden="true">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="check" size={20} stroke={3} style={{ color: '#fff' }} /></div>
          <div><div className="brand-name">Habitech</div><div className="brand-sub">Habit tracker</div></div>
        </div>
        {['Today', 'Focus timer', 'Habits', 'Reports', 'Settings'].map((l, i) => (
          <div key={l} className={`nav-item ${i === 0 ? 'active' : ''}`}>{l}</div>
        ))}
      </nav>
      <main className="main">
        <header className="page-head">
          <div><div className="eyebrow">Today</div><h1>{formatLong(todayKey())}</h1></div>
        </header>
        <div className="hero">
          <div className="mock-ring" />
          <div><div className="hero-figure">3 / 5</div><div className="hero-label">2 habits left today</div></div>
        </div>
        <div className="grid grid-3 mt">
          <div className="card span-2">
            {bars.map((w, i) => (
              <div key={i} className="habit-row" style={{ marginBottom: 10 }}>
                <span className={`check ${i < 3 ? 'on' : ''}`} />
                <div><div className="mock-line" style={{ width: `${w}%` }} /><div className="mock-line thin" style={{ width: `${w / 2}%` }} /></div>
                <span />
              </div>
            ))}
          </div>
          <div className="stack">
            <div className="card stat stat-accent"><div className="stat-label">30-day completion</div><div className="stat-value">—</div></div>
            <div className="card stat"><div className="stat-label">Streaks</div><div className="mock-line" /><div className="mock-line" /></div>
          </div>
        </div>
      </main>
    </div>
  );
}
