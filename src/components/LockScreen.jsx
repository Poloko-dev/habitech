import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { unlock, setupToken } from '../lib/auth.js';
import { formatLong, todayKey } from '../lib/dates.js';

const MIN_TOKEN = 8;
const UNREACHABLE = 'Can’t reach the server. Is it running?';

/** Password-style input with a show/hide toggle. */
export function TokenField({ id, label, value, onChange, inputRef, autoComplete, disabled, invalid, describedBy, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id} className={placeholder ? 'sr-only' : undefined}>{label}</label>
      <div className="token-input">
        <input id={id} ref={inputRef} className="input" type={show ? 'text' : 'password'} autoComplete={autoComplete}
          placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          aria-invalid={invalid || undefined} aria-describedby={describedBy} />
        <button type="button" className="token-eye" onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} title={show ? 'Hide' : 'Show'}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
    </div>
  );
}

/**
 * Shown until the app is unlocked. On first launch (no token yet) it asks the user to
 * create one, which the server stores hashed. Behind the form is a blurred mock-up of
 * the Today page – no real data is loaded while locked.
 */
export function LockScreen({ setupRequired, statusError, onUnlocked, onRetry }) {
  const [token, setToken] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const input = useRef(null);

  useEffect(() => input.current?.focus(), [setupRequired]);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submitUnlock = async (e) => {
    e.preventDefault();
    if (!token.trim() || busy || wait > 0) return;
    setBusy(true);
    setError('');
    const res = await unlock(token).catch(() => ({ ok: false, error: UNREACHABLE }));
    setBusy(false);
    if (res.ok) return onUnlocked();
    setError(res.error);
    if (res.retryAfter) setWait(res.retryAfter);
    setToken('');
    input.current?.focus();
  };

  const submitSetup = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (token.trim().length < MIN_TOKEN) return setError(`Use at least ${MIN_TOKEN} characters.`);
    if (token !== confirm) return setError('The two tokens don’t match.');
    setBusy(true);
    setError('');
    const res = await setupToken(token).catch(() => ({ ok: false, error: UNREACHABLE }));
    setBusy(false);
    if (res.ok) return onUnlocked();
    setError(res.error);
  };

  let body;
  if (statusError) {
    body = (
      <>
        <h1 id="lock-title">Can’t reach your data</h1>
        <p className="lock-warn" role="alert">{statusError}</p>
        <button type="button" className="btn btn-primary lock-submit" onClick={onRetry}>Try again</button>
      </>
    );
  } else if (setupRequired) {
    body = (
      <>
        <h1 id="lock-title">Create your access token</h1>
        <p className="muted">Choose a token to protect your habits. You’ll enter it to unlock the app. It’s stored securely (hashed) in your database.</p>
        <TokenField id="setup-token" label="New access token" value={token} onChange={setToken} inputRef={input}
          autoComplete="new-password" invalid={Boolean(error)} />
        <TokenField id="setup-confirm" label="Confirm token" value={confirm} onChange={setConfirm}
          autoComplete="new-password" invalid={Boolean(error)} describedBy={error ? 'lock-error' : undefined} />
        <p className="muted small lock-hint">At least {MIN_TOKEN} characters. If you forget it, see “Reset a forgotten token” in the README.</p>
        {error && <p id="lock-error" className="error-text" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary lock-submit" disabled={busy || !token || !confirm}>
          <Icon name="lock" size={16} />{busy ? 'Saving…' : 'Create token & unlock'}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <h1 id="lock-title">Habitech is locked</h1>
        <p className="muted">Enter your access token to continue.</p>
        <TokenField id="lock-token" label="Access token" placeholder="Access token" value={token} onChange={setToken}
          inputRef={input} autoComplete="current-password" disabled={wait > 0} invalid={Boolean(error)}
          describedBy={error ? 'lock-error' : undefined} />
        {(error || wait > 0) && (
          <p id="lock-error" className="error-text" role="alert">
            {wait > 0 ? `Too many attempts. Try again in ${wait}s.` : error}
          </p>
        )}
        <button type="submit" className="btn btn-primary lock-submit" disabled={busy || wait > 0 || !token.trim()}>
          <Icon name="lock" size={16} />{busy ? 'Checking…' : 'Unlock'}
        </button>
      </>
    );
  }

  return (
    <div className="lock">
      <MockToday />

      <div className="lock-overlay">
        <form className="lock-card" onSubmit={setupRequired ? submitSetup : submitUnlock} aria-labelledby="lock-title">
          <div className="lock-icon"><Icon name="lock" size={24} /></div>
          {body}
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
