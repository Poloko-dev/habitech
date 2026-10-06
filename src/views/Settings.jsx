import { useEffect, useState } from 'react';
import { Card, PageHead, Icon, Badge } from '../components/ui.jsx';
import { TokenField } from '../components/LockScreen.jsx';
import { authStatus, changeToken } from '../lib/auth.js';

export function Settings({ data, dataOptions, onLock }) {
  const [source, setSource] = useState(null); // 'stored' | 'env'
  useEffect(() => {
    authStatus().then((s) => setSource(s.source)).catch(() => {});
  }, []);

  return (
    <>
      <PageHead eyebrow="Settings" title="Settings" sub="Manage access, your data and demo content." />
      <div className="stack">
        <Card title="Security" hint="The app asks for your access token before showing anything.">
          <div className="data-rows">
            <div className="data-row">
              <div>
                <div className="strong">Lock now</div>
                <div className="muted small">This browser stays unlocked for 7 days, or until you lock it.</div>
              </div>
              <button className="btn btn-navy" onClick={onLock}><Icon name="lock" size={15} />Lock app</button>
            </div>
            {source === 'stored' && <ChangeTokenRow />}
            {source === 'env' && (
              <div className="data-row">
                <div>
                  <div className="strong">Access token</div>
                  <div className="muted small">Set by <code>PASS_TOKEN</code> on the server. Change it there to use a different token.</div>
                </div>
              </div>
            )}
          </div>
        </Card>
        <DataCard data={data} {...dataOptions} />
      </div>
    </>
  );
}

function ChangeTokenRow() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null); // { tone: 'error' | 'ok', text }
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };
  const submit = async (e) => {
    e.preventDefault();
    if (next.trim().length < 8) return setMsg({ tone: 'error', text: 'Use at least 8 characters for the new token.' });
    if (next !== confirm) return setMsg({ tone: 'error', text: 'The new tokens don’t match.' });
    setBusy(true);
    const res = await changeToken(current, next).catch(() => ({ ok: false, error: 'Can’t reach the server.' }));
    setBusy(false);
    if (!res.ok) return setMsg({ tone: 'error', text: res.error });
    reset();
    setOpen(false);
    setMsg({ tone: 'ok', text: 'Token changed. Other browsers have been signed out.' });
  };

  return (
    <div className="data-row token-row">
      <div style={{ width: '100%' }}>
        <div className="token-row-head">
          <div>
            <div className="strong">Access token</div>
            <div className="muted small">Stored hashed in your database. Changing it signs out every other browser.</div>
          </div>
          {!open && (
            <button className="btn" onClick={() => { setOpen(true); setMsg(null); }}>
              <Icon name="edit" size={15} />Change token
            </button>
          )}
        </div>
        {msg && !open && <p className={msg.tone === 'ok' ? 'ok-text' : 'error-text'} role="status">{msg.text}</p>}
        {open && (
          <form className="token-form" onSubmit={submit}>
            <TokenField id="tok-current" label="Current token" value={current} onChange={setCurrent} autoComplete="current-password" />
            <TokenField id="tok-new" label="New token" value={next} onChange={setNext} autoComplete="new-password" />
            <TokenField id="tok-confirm" label="Confirm new token" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {msg && <p className={msg.tone === 'ok' ? 'ok-text' : 'error-text'} role="alert">{msg.text}</p>}
            <div className="token-form-actions">
              <button type="button" className="btn" onClick={() => { setOpen(false); reset(); setMsg(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !current || !next || !confirm}>
                {busy ? 'Saving…' : 'Save new token'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function DataCard({ data, demoLoaded, prefs, setPrefs, onLoadDemo, onRemoveDemo, onEraseAll }) {
  const empty = !data.habits.length && !Object.keys(data.logs).length && !(data.pomodoro?.sessions?.length);
  return (
    <Card title="Your data" hint="Add the habits you want to build. Every check-in is saved to storage.json and feeds your daily, weekly and monthly reports.">
      <div className="data-rows">
        {demoLoaded ? (
          <div className="data-row">
            <div>
              <div className="strong">Demo data is loaded <Badge tone="pink">Demo</Badge></div>
              <div className="muted small">Sample habits, 90 days of check-ins and focus sessions. Starting a clean sheet removes them and keeps anything you added yourself.</div>
            </div>
            <button className="btn btn-primary" onClick={onRemoveDemo}>Start clean sheet</button>
          </div>
        ) : (
          <div className="data-row">
            <div>
              <div className="strong">Demo data</div>
              <div className="muted small">Load 90 days of sample habits to explore the reports. This replaces your current data.</div>
            </div>
            <button className="btn" onClick={onLoadDemo}>Load demo data</button>
          </div>
        )}
        <label className="toggle data-row">
          <input type="checkbox" checked={prefs.showDemoShortcuts}
            onChange={(e) => setPrefs({ showDemoShortcuts: e.target.checked })} />
          <span>
            <span className="strong">Show “Load demo data” shortcuts</span>
            <span className="muted small" style={{ display: 'block' }}>Shows a “Load demo data” button on the empty Today page. Turn off for a clean, demo-free app.</span>
          </span>
        </label>
        <div className="data-row">
          <div>
            <div className="strong">Erase everything</div>
            <div className="muted small">Delete all habits, check-ins, journal notes and focus sessions. Timer settings are kept. This can’t be undone.</div>
          </div>
          <button className="btn btn-danger" onClick={onEraseAll} disabled={empty}>
            <Icon name="trash" size={15} />Erase all data
          </button>
        </div>
      </div>
    </Card>
  );
}
