import { useEffect, useMemo, useState } from 'react';
import { Card, PageHead, Icon, Segmented, StatTile } from '../components/ui.jsx';
import { MinutesColumns } from '../components/Charts.jsx';
import { MODES, focusInRange, formatMinutes, formatClock } from '../lib/pomodoro.js';
import { SOUND_OPTIONS, playSound, unlockAudio } from '../lib/sound.js';
import { todayKey, addDays, startOfWeek, formatShort, formatLong } from '../lib/dates.js';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** Number input that only commits valid values (on blur / Enter), so typing isn't fought. */
function NumberField({ id, label, value, min, max, suffix, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= min && n <= max) onCommit(n);
    else setDraft(String(value));
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-suffix">
        <input id={id} className="input" type="number" inputMode="numeric" min={min} max={max} value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}

function TimerRing({ fraction, mode, children }) {
  const size = 280;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = mode === 'focus' ? 'var(--pink-500)' : 'var(--series-previous)';
  const track = mode === 'focus' ? 'var(--pink-100)' : '#e3ebf7';
  return (
    <div className="timer-ring">
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {fraction > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * fraction} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <div className="timer-center">{children}</div>
    </div>
  );
}

export function Focus({ data, pomo }) {
  const { settings, timer, remainingMs, totalMs } = pomo;
  const today = todayKey();
  const elapsed = totalMs ? 1 - remainingMs / totalMs : 0;
  const started = timer.running || timer.startedAt;

  const stats = useMemo(() => {
    const day = focusInRange(data, today, today);
    const week = focusInRange(data, startOfWeek(today), today);
    const lastWeekStart = addDays(startOfWeek(today), -7);
    // Same number of days into last week, for a fair comparison.
    const lastWeek = focusInRange(data, lastWeekStart, addDays(lastWeekStart, week.days.length - 1));
    const last14 = focusInRange(data, addDays(today, -13), today);
    return { day, week, lastWeek, last14 };
  }, [data, today]);

  // Space bar starts / pauses (when not typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target.closest('input, select, textarea, button, [contenteditable]')) return;
      e.preventDefault();
      if (timer.running) pomo.pause();
      else pomo.start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timer.running, pomo]);

  const changeMode = (m) => {
    if (m === timer.mode) return;
    if (started && !window.confirm('Switch mode and discard the current timer?')) return;
    pomo.setMode(m);
  };
  const doneInSet = timer.cycle % settings.longEvery;
  const filled = timer.mode === 'long' ? settings.longEvery : doneInSet;
  const weekDelta = stats.week.minutes - stats.lastWeek.minutes;
  const goalPct = Math.min(1, stats.day.count / Math.max(1, settings.dailyGoal));
  const test = (name) => {
    unlockAudio();
    playSound(name, settings.volume);
  };

  return (
    <>
      <PageHead eyebrow="Focus" title="Pomodoro timer"
        sub="Work in focused blocks with short breaks. A sound plays when time is up." />

      <div className="grid grid-3">
        <div className="span-2 stack">
          <Card className="timer-card">
            <Segmented label="Timer mode" value={timer.mode} onChange={changeMode}
              options={Object.entries(MODES).map(([value, m]) => ({ value, label: m.label }))} />

            <TimerRing fraction={elapsed} mode={timer.mode}>
              <div className="timer-clock" role="timer" aria-live="off">{formatClock(remainingMs)}</div>
              <div className="timer-state">
                {timer.running ? MODES[timer.mode].label : started ? 'Paused' : 'Ready'}
              </div>
            </TimerRing>

            <div className="timer-controls">
              <button className="icon-btn lg" onClick={pomo.reset} disabled={!started} aria-label="Reset timer" title="Reset">
                <Icon name="restore" size={20} />
              </button>
              <button className={`play-btn ${timer.mode !== 'focus' ? 'break' : ''}`}
                onClick={timer.running ? pomo.pause : pomo.start} aria-label={timer.running ? 'Pause' : 'Start'}>
                <Icon name={timer.running ? 'pause' : 'play'} size={30} stroke={2.5}
                  fill={timer.running ? 'none' : 'currentColor'} />
              </button>
              <button className="icon-btn lg" onClick={pomo.skip} aria-label="Skip to next phase" title="Skip">
                <Icon name="skip" size={20} />
              </button>
            </div>

            <div className="cycle">
              <div className="cycle-dots" aria-hidden="true">
                {Array.from({ length: settings.longEvery }, (_, i) => (
                  <span key={i} className={i < filled ? 'on' : i === filled && timer.mode === 'focus' ? 'now' : ''} />
                ))}
              </div>
              <span className="muted small">
                {timer.mode === 'focus'
                  ? `Session ${doneInSet + 1} of ${settings.longEvery} · long break after ${settings.longEvery}`
                  : timer.mode === 'long'
                    ? 'Set complete — enjoy the long break'
                    : `${doneInSet} of ${settings.longEvery} sessions done in this set`}
              </span>
            </div>
          </Card>
          <Card title="Focus time, last 14 days" hint={`${formatMinutes(stats.last14.minutes)} across ${stats.last14.count} sessions`}>
            <MinutesColumns data={stats.last14.days.map((d) => ({
              label: formatShort(d.key), tipTitle: formatLong(d.key), minutes: d.minutes, sessions: d.sessions,
            }))} />
          </Card>
        </div>

        <div className="stack">
          <StatTile accent label="Focus today" value={formatMinutes(stats.day.minutes)}
            foot={
              <span style={{ width: '100%' }}>
                {stats.day.count} of {settings.dailyGoal} sessions
                <span className="mini-progress" style={{ display: 'block', maxWidth: 'none' }}>
                  <span style={{ width: `${goalPct * 100}%` }} />
                </span>
              </span>
            } />
          <StatTile label="This week" value={formatMinutes(stats.week.minutes)}
            foot={
              <>
                <span className={`delta ${weekDelta > 0 ? 'up' : weekDelta < 0 ? 'down' : 'flat'}`}>
                  {weekDelta > 0 ? '▲ +' : weekDelta < 0 ? '▼ −' : '■ '}{formatMinutes(Math.abs(weekDelta))}
                </span>
                <span>vs same point last week</span>
              </>
            } />

          <Card title="Today’s sessions" hint={stats.day.count ? `${stats.day.count} completed` : 'Completed focus sessions appear here'}>
            <SessionList sessions={stats.day.sessions} habits={data.habits} />
          </Card>

          <Card title="Timer settings">
            <div className="settings">
              <div className="row-3">
                <NumberField id="s-focus" label="Focus" suffix="min" value={settings.focus} min={1} max={180}
                  onCommit={(v) => pomo.setSettings({ focus: v })} />
                <NumberField id="s-short" label="Short break" suffix="min" value={settings.short} min={1} max={60}
                  onCommit={(v) => pomo.setSettings({ short: v })} />
                <NumberField id="s-long" label="Long break" suffix="min" value={settings.long} min={1} max={90}
                  onCommit={(v) => pomo.setSettings({ long: v })} />
              </div>
              <div className="row-2">
                <NumberField id="s-every" label="Long break every" suffix="sessions" value={settings.longEvery} min={2} max={12}
                  onCommit={(v) => pomo.setSettings({ longEvery: v })} />
                <NumberField id="s-goal" label="Daily goal" suffix="sessions" value={settings.dailyGoal} min={1} max={24}
                  onCommit={(v) => pomo.setSettings({ dailyGoal: v })} />
              </div>

              <label className="toggle">
                <input type="checkbox" checked={settings.autoStartBreaks}
                  onChange={(e) => pomo.setSettings({ autoStartBreaks: e.target.checked })} />
                <span>Start breaks automatically</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={settings.autoStartFocus}
                  onChange={(e) => pomo.setSettings({ autoStartFocus: e.target.checked })} />
                <span>Start the next focus session automatically</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={settings.notify}
                  onChange={(e) => pomo.setSettings({ notify: e.target.checked })} />
                <span>Desktop notification when the tab is in the background</span>
              </label>

              <div className="settings-sep" />
              <div className="sound-row">
                <div className="field">
                  <label htmlFor="s-fsound">Sound when focus ends</label>
                  <select id="s-fsound" className="select" value={settings.focusSound}
                    onChange={(e) => { pomo.setSettings({ focusSound: e.target.value }); test(e.target.value); }}>
                    {SOUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button className="btn" onClick={() => test(settings.focusSound)} disabled={settings.focusSound === 'none'}>
                  <Icon name="volume" size={16} />Test
                </button>
              </div>
              <div className="sound-row">
                <div className="field">
                  <label htmlFor="s-bsound">Sound when a break ends</label>
                  <select id="s-bsound" className="select" value={settings.breakSound}
                    onChange={(e) => { pomo.setSettings({ breakSound: e.target.value }); test(e.target.value); }}>
                    {SOUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button className="btn" onClick={() => test(settings.breakSound)} disabled={settings.breakSound === 'none'}>
                  <Icon name="volume" size={16} />Test
                </button>
              </div>
              <div className="field">
                <label htmlFor="s-vol">Volume · {Math.round(settings.volume * 100)}%</label>
                <input id="s-vol" type="range" className="range" min="0" max="1" step="0.05" value={settings.volume}
                  onChange={(e) => pomo.setSettings({ volume: Number(e.target.value) })}
                  onPointerUp={() => test(settings.focusSound !== 'none' ? settings.focusSound : 'chime')} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export function SessionList({ sessions, habits }) {
  if (!sessions.length) return <p className="muted">No focus sessions yet.</p>;
  return (
    <ul className="session-list">
      {[...sessions].reverse().map((s) => {
        const h = habits.find((x) => x.id === s.habitId);
        return (
          <li key={s.id}>
            <span className="session-time">
              {s.startedAt ? `${timeFmt.format(new Date(s.startedAt))} – ` : ''}{timeFmt.format(new Date(s.endedAt))}
            </span>
            <span className="session-habit">
              {h ? <><span className="swatch" style={{ background: h.color }} />{h.name}</> : <span className="muted">Focus</span>}
            </span>
            <b>{s.minutes} min</b>
          </li>
        );
      })}
    </ul>
  );
}
