import { Card, PageHead, Icon, Badge } from '../components/ui.jsx';

export function Settings({ data, dataOptions, onLock }) {
  return (
    <>
      <PageHead eyebrow="Settings" title="Settings" sub="Manage access, your data and demo content." />
      <div className="stack">
        <Card title="Security" hint="The app asks for the access token (PASS_TOKEN in .env) before showing anything.">
          <div className="data-rows">
            <div className="data-row">
              <div>
                <div className="strong">Lock now</div>
                <div className="muted small">This browser stays unlocked for 7 days, or until you lock it or the server restarts.</div>
              </div>
              <button className="btn btn-navy" onClick={onLock}><Icon name="lock" size={15} />Lock app</button>
            </div>
          </div>
        </Card>
        <DataCard data={data} {...dataOptions} />
      </div>
    </>
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
