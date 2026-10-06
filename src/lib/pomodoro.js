import { toKey, eachDay } from './dates.js';
import { uid } from './store.js';

// Stored in storage.json under `pomodoro`:
//   settings – durations, sounds, auto-start…
//   active   – the current timer ({ mode, running, endsAt, remainingMs, durationMin, cycle, startedAt })
//   sessions – completed focus sessions ({ id, date, startedAt, endedAt, minutes, habitId })

export const DEFAULT_SETTINGS = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  focusSound: 'chime',
  breakSound: 'soft',
  volume: 0.7,
  notify: false,
  dailyGoal: 4,
  habitId: null,
};

export const MODES = {
  focus: { label: 'Focus', done: 'Focus session complete', next: 'Time for a break.' },
  short: { label: 'Short break', done: 'Break is over', next: 'Ready for the next focus session?' },
  long: { label: 'Long break', done: 'Long break is over', next: 'Ready to start a new set?' },
};

export function getPomodoro(data) {
  const p = data.pomodoro || {};
  return {
    settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) },
    active: p.active || null,
    sessions: p.sessions || [],
  };
}

const withPomodoro = (data, patch) => ({ ...data, pomodoro: { ...getPomodoro(data), ...patch } });

export function idleTimer(settings, mode = 'focus', cycle = 0) {
  const durationMin = settings[mode];
  return { mode, running: false, endsAt: null, remainingMs: durationMin * 60000, durationMin, cycle, startedAt: null };
}

export const currentTimer = (data) => {
  const { settings, active } = getPomodoro(data);
  return active || idleTimer(settings);
};

export const remainingMs = (t, now = Date.now()) => (t.running ? Math.max(0, t.endsAt - now) : t.remainingMs);

const startTimer = (t, now) => ({
  ...t,
  running: true,
  endsAt: now + t.remainingMs,
  startedAt: t.startedAt ?? new Date(now).toISOString(),
});

function nextAfter(t, settings, counted) {
  if (t.mode === 'focus') {
    const cycle = counted ? t.cycle + 1 : t.cycle;
    const mode = counted && cycle % settings.longEvery === 0 ? 'long' : 'short';
    return idleTimer(settings, mode, cycle);
  }
  return idleTimer(settings, 'focus', t.mode === 'long' ? 0 : t.cycle);
}

// ---------- actions (pure: data -> data) ----------

export const start = (data, now = Date.now()) => withPomodoro(data, { active: startTimer(currentTimer(data), now) });

export const pause = (data, now = Date.now()) => {
  const t = currentTimer(data);
  if (!t.running) return data;
  return withPomodoro(data, { active: { ...t, running: false, endsAt: null, remainingMs: remainingMs(t, now) } });
};

export const reset = (data) => {
  const { settings } = getPomodoro(data);
  const t = currentTimer(data);
  return withPomodoro(data, { active: idleTimer(settings, t.mode, t.cycle) });
};

/** Jump to the next phase without logging the current one. */
export const skip = (data) => {
  const { settings } = getPomodoro(data);
  return withPomodoro(data, { active: nextAfter(currentTimer(data), settings, false) });
};

export const setMode = (data, mode) => {
  const { settings } = getPomodoro(data);
  return withPomodoro(data, { active: idleTimer(settings, mode, currentTimer(data).cycle) });
};

export function setSettings(data, patch) {
  const p = getPomodoro(data);
  const settings = { ...p.settings, ...patch };
  let active = p.active;
  // An untouched timer picks up new durations straight away.
  if (!active || (!active.running && !active.startedAt)) {
    active = idleTimer(settings, active?.mode ?? 'focus', active?.cycle ?? 0);
  }
  return withPomodoro(data, { settings, active });
}

/**
 * Finish the running phase that was due at `endsAt`. Idempotent: does nothing if the
 * timer has already moved on. Completed focus sessions are logged.
 */
export function complete(data, endsAt, now = Date.now()) {
  const p = getPomodoro(data);
  const t = p.active;
  if (!t || !t.running || t.endsAt !== endsAt) return data;

  let { sessions } = p;
  if (t.mode === 'focus') {
    sessions = [
      ...sessions,
      {
        id: uid(),
        date: toKey(new Date(endsAt)),
        startedAt: t.startedAt,
        endedAt: new Date(endsAt).toISOString(),
        minutes: t.durationMin,
        habitId: null,
      },
    ];
  }

  let next = nextAfter(t, p.settings, true);
  const autoStart = next.mode === 'focus' ? p.settings.autoStartFocus : p.settings.autoStartBreaks;
  // Don't auto-start a new phase if the app was closed when this one ended.
  if (autoStart && now - endsAt < 60000) next = startTimer(next, now);

  return { ...data, pomodoro: { ...p, active: next, sessions } };
}

// ---------- stats ----------

export function focusInRange(data, start, end) {
  const { sessions } = getPomodoro(data);
  const inRange = sessions.filter((s) => s.date >= start && s.date <= end);
  const byKey = {};
  for (const s of inRange) {
    const b = (byKey[s.date] ??= { minutes: 0, sessions: 0 });
    b.minutes += s.minutes;
    b.sessions += 1;
  }
  const days = eachDay(start, end).map((key) => ({ key, ...(byKey[key] || { minutes: 0, sessions: 0 }) }));
  return {
    days,
    sessions: inRange,
    minutes: inRange.reduce((n, s) => n + s.minutes, 0),
    count: inRange.length,
    activeDays: days.filter((d) => d.sessions > 0).length,
  };
}

export function formatMinutes(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
