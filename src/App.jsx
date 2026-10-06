import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './lib/store.js';
import { newHabit, withDemo, removeDemo, eraseAll, getPrefs, hasDemo } from './lib/habits.js';
import { todayKey } from './lib/dates.js';
import { Icon } from './components/ui.jsx';
import { HabitForm } from './components/HabitForm.jsx';
import { Today } from './views/Today.jsx';
import { Habits } from './views/Habits.jsx';
import { Settings } from './views/Settings.jsx';
import { DailyReport } from './views/DailyReport.jsx';
import { WeeklyReport } from './views/WeeklyReport.jsx';
import { MonthlyReport } from './views/MonthlyReport.jsx';
import { Focus } from './views/Focus.jsx';
import { usePomodoro } from './lib/usePomodoro.js';
import { lockApp } from './lib/auth.js';
import { MODES, formatClock } from './lib/pomodoro.js';

const NAV = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'focus', label: 'Focus timer', short: 'Focus', icon: 'timer' },
  { id: 'habits', label: 'Habits', icon: 'habits' },
  { id: 'reports', label: 'Reports', icon: 'weekly' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const REPORT_TABS = [
  { id: 'daily', label: 'Daily', icon: 'daily' },
  { id: 'weekly', label: 'Weekly', icon: 'weekly' },
  { id: 'monthly', label: 'Monthly', icon: 'monthly' },
];
const PAGES = new Set(['today', 'focus', 'habits', 'settings']);
const TABS = new Set(REPORT_TABS.map((t) => t.id));

// Route lives in the hash (#/reports/weekly/2026-09-29) so reloads keep the view, tab and period.
// Older links like #/weekly/2026-09-29 still work.
function readHash() {
  let [view, tab, date] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (TABS.has(view)) [view, tab, date] = ['reports', view, tab];
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date <= todayKey();
  if (view === 'reports') return { view, tab: TABS.has(tab) ? tab : 'daily', date: valid ? date : todayKey() };
  return { view: PAGES.has(view) ? view : 'today', tab: null, date: todayKey() };
}

export default function App() {
  const { data, update, status, error, retry } = useStore();
  const [route, setRoute] = useState(readHash);
  const [editing, setEditing] = useState(null);
  const pomo = usePomodoro(data, update);

  useEffect(() => {
    const onHash = () => setRoute(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 'reports' reopens the last report tab used; 'daily' | 'weekly' | 'monthly' open that tab.
  const lastTab = useRef(route.tab || 'daily');
  if (route.tab) lastTab.current = route.tab;
  const go = useCallback((view, date = route.date) => {
    const tab = view === 'reports' ? lastTab.current : view;
    window.location.hash = TABS.has(tab) ? `/reports/${tab}/${date}` : `/${view}`;
  }, [route.date]);
  const setDate = (date) => go(route.tab, date);
  const openDay = (date) => go('daily', date);
  const openFocus = () => go('focus');

  const saveHabit = (habit) => {
    update((d) => ({
      ...d,
      habits: d.habits.some((h) => h.id === habit.id)
        ? d.habits.map((h) => (h.id === habit.id ? habit : h))
        : [...d.habits, habit],
    }));
    setEditing(null);
  };
  const loadDemo = () => {
    if (data.habits.some((h) => !h.demo)
      && !window.confirm('Loading demo data replaces your current habits and history. Continue?')) return;
    update(withDemo);
  };
  // Clean sheet: drop the sample data (keeping anything the user added) and hide the demo shortcuts.
  const startClean = () => {
    if (!window.confirm('Remove the demo habits, check-ins, notes and focus sessions? Anything you added yourself is kept.')) return;
    update((d) => ({ ...removeDemo(d), prefs: { ...getPrefs(d), showDemoShortcuts: false } }));
    go('today');
  };
  const eraseEverything = () => {
    if (!window.confirm('Erase ALL habits, check-ins, journal notes and focus sessions? This can’t be undone. (Timer settings are kept.)')) return;
    update(eraseAll);
    go('today');
  };
  const setPrefs = (patch) => update((d) => ({ ...d, prefs: { ...getPrefs(d), ...patch } }));

  if (!data) {
    return (
      <div className="main" style={{ maxWidth: 640 }}>
        {status === 'error' ? (
          <div className="banner-error">
            <span>Couldn’t load your data: {error}</span>
            <button className="btn btn-sm" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : <p className="muted">Loading your habits…</p>}
      </div>
    );
  }

  const props = { data, update };
  const prefs = getPrefs(data);
  const demoLoaded = hasDemo(data);
  const dataOptions = { demoLoaded, prefs, setPrefs, onLoadDemo: loadDemo, onRemoveDemo: startClean, onEraseAll: eraseEverything };
  const lock = () => lockApp(retry); // saves pending changes first
  const page = {
    today: <Today {...props} go={go} onAddHabit={() => setEditing(newHabit(data.habits))}
      onLoadDemo={prefs.showDemoShortcuts ? loadDemo : null} />,
    focus: <Focus data={data} pomo={pomo} />,
    habits: <Habits {...props} onAddHabit={() => setEditing(newHabit(data.habits))} onEditHabit={setEditing} />,
    settings: <Settings data={data} dataOptions={dataOptions} onLock={lock} />,
    reports: (
      <>
        <div className="report-tabs" role="tablist" aria-label="Report period">
          {REPORT_TABS.map((tab, i) => (
            <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={route.tab === tab.id}
              aria-controls="report-panel" tabIndex={route.tab === tab.id ? 0 : -1}
              className={route.tab === tab.id ? 'active' : ''} onClick={() => go(tab.id)}
              onKeyDown={(e) => {
                // Arrow keys move between tabs (standard tablist behaviour).
                const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
                if (!step) return;
                const next = REPORT_TABS[(i + step + REPORT_TABS.length) % REPORT_TABS.length];
                go(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }}>
              <Icon name={tab.icon} size={16} />{tab.label}
            </button>
          ))}
        </div>
        <div id="report-panel" role="tabpanel" aria-labelledby={`tab-${route.tab}`}>
          {{
            daily: <DailyReport {...props} date={route.date} setDate={setDate} openFocus={openFocus} />,
            weekly: <WeeklyReport data={data} anchor={route.date} setAnchor={setDate} openDay={openDay} openFocus={openFocus} />,
            monthly: <MonthlyReport data={data} anchor={route.date} setAnchor={setDate} openDay={openDay} openFocus={openFocus} />,
          }[route.tab]}
        </div>
      </>
    ),
  }[route.view];

  const navButton = (n) => (
    <button key={n.id} className={`nav-item ${route.view === n.id ? 'active' : ''}`}
      aria-current={route.view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
      <Icon name={n.icon} size={17} />{n.label}
    </button>
  );

  // Running/paused timer shortcut, shown everywhere except the Focus page itself.
  const t = pomo.timer;
  const timerPill = (t.running || t.startedAt) && route.view !== 'focus' && (
    <button className={`timer-pill ${t.mode !== 'focus' ? 'break' : ''} ${t.running ? '' : 'paused'}`} onClick={openFocus}
      aria-label={`${MODES[t.mode].label} timer, ${formatClock(pomo.remainingMs)} left. Open focus timer`}>
      <Icon name={t.running ? 'timer' : 'pause'} size={15} />
      <span>{formatClock(pomo.remainingMs)}</span>
    </button>
  );

  const statusText = { saved: 'Habitech', saving: 'Saving…', error: 'Save failed', loading: 'Loading…' }[status];

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark"><Icon name="check" size={20} stroke={3} style={{ color: '#fff' }} /></div>
          <div>
            <div className="brand-name">Habitech</div>
            <div className="brand-sub">Habit tracker</div>
          </div>
        </div>
        <div className="nav-label">Menu</div>
        {NAV.map(navButton)}
        {timerPill && <div className="sidebar-pill">{timerPill}</div>}
        <div className="sidebar-foot">
          <div className="sidebar-status">
            <span><span className={`save-dot ${status}`} />{statusText}</span>
            <button className="lock-btn" onClick={lock} aria-label="Lock app" title="Lock app"><Icon name="lock" size={15} /></button>
          </div>
          {status === 'error' && <button className="btn btn-sm" onClick={retry}>Retry save</button>}
        </div>
      </nav>

      {/* Mobile chrome: top bar + bottom tab bar replace the sidebar on small screens. */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="check" size={18} stroke={3} style={{ color: '#fff' }} /></div>
          <div className="brand-name">Habitech</div>
        </div>
        {timerPill}
        <span className="topbar-status" role="status"><span className={`save-dot ${status}`} />{statusText.replace(' to storage.json', '')}</span>
      </header>
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} className={route.view === n.id ? 'active' : ''}
            aria-current={route.view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <Icon name={n.icon} size={20} />
            <span>{n.short ?? n.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {status === 'error' && (
          <div className="banner-error">
            <span>Couldn’t save your changes: {error}</span>
            <button className="btn btn-sm" onClick={retry}>Retry</button>
          </div>
        )}
        {demoLoaded && !prefs.demoBannerHidden && (
          <div className="demo-banner" role="status">
            <span className="demo-banner-ico"><Icon name="spark" size={16} /></span>
            <div className="demo-banner-text">
              <b>You’re exploring demo data.</b>{' '}
              <span>Ready for your own habits? Start a clean sheet — anything you added yourself is kept.</span>
            </div>
            <div className="demo-banner-actions">
              <button className="btn btn-sm btn-primary" onClick={startClean}>Start clean sheet</button>
              <button className="icon-btn" onClick={() => setPrefs({ demoBannerHidden: true })}
                aria-label="Hide this banner" title="Hide (you can still remove demo data in Settings)">
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        )}
        {page}
      </main>

      {pomo.toast && (
        <div className="toast" role="alert" key={pomo.toast.id}>
          <span className="toast-ico"><Icon name="bell" size={18} /></span>
          <div>
            <div className="strong">{pomo.toast.title}</div>
            <div className="small muted">{pomo.toast.body}</div>
          </div>
          {route.view !== 'focus' && <button className="btn btn-sm" onClick={() => { pomo.dismissToast(); openFocus(); }}>Open</button>}
          <button className="icon-btn" onClick={pomo.dismissToast} aria-label="Dismiss"><Icon name="close" size={16} /></button>
        </div>
      )}

      {editing && <HabitForm initial={editing} onSave={saveHabit} onClose={() => setEditing(null)} />}
    </div>
  );
}
