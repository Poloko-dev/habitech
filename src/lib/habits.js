import { addDays, todayKey, weekday, parseKey } from './dates.js';
import { uid } from './store.js';

// Habit identity colors – a CVD-validated categorical palette, assigned in fixed order.
export const HABIT_COLORS = [
  { name: 'Blue', hex: '#2a78d6' },
  { name: 'Orange', hex: '#eb6834' },
  { name: 'Aqua', hex: '#1baf7a' },
  { name: 'Yellow', hex: '#eda100' },
  { name: 'Magenta', hex: '#e87ba4' },
  { name: 'Green', hex: '#008300' },
  { name: 'Violet', hex: '#4a3aa7' },
  { name: 'Red', hex: '#e34948' },
];

export const CATEGORIES = ['Health', 'Fitness', 'Mind', 'Learning', 'Productivity', 'Finance', 'Social', 'Other'];

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];

export function nextColor(habits) {
  const used = new Set(habits.filter((h) => !h.archivedAt).map((h) => h.color));
  return (HABIT_COLORS.find((c) => !used.has(c.hex)) || HABIT_COLORS[habits.length % HABIT_COLORS.length]).hex;
}

export function newHabit(habits, fields) {
  return {
    id: uid(),
    name: '',
    description: '',
    category: 'Health',
    color: nextColor(habits),
    target: 1,
    unit: '',
    schedule: EVERY_DAY,
    createdAt: todayKey(),
    archivedAt: null,
    ...fields,
  };
}

export function scheduleLabel(schedule) {
  const s = [...schedule].sort().join(',');
  if (s === '0,1,2,3,4,5,6') return 'Every day';
  if (s === '1,2,3,4,5') return 'Weekdays';
  if (s === '0,6') return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => schedule.includes(d)).map((d) => names[d]).join(', ');
}

/** 90 days of realistic sample history so the reports have something to show. */
export function demoData() {
  const start = addDays(todayKey(), -89);
  const defs = [
    { name: 'Drink water', category: 'Health', target: 8, unit: 'glasses', schedule: EVERY_DAY, p: 0.82, desc: '8 glasses a day' },
    { name: 'Morning workout', category: 'Fitness', target: 1, unit: '', schedule: [1, 3, 5], p: 0.75, desc: '30 min strength or cardio' },
    { name: 'Read', category: 'Learning', target: 20, unit: 'pages', schedule: EVERY_DAY, p: 0.68, desc: '20 pages before bed' },
    { name: 'Meditate', category: 'Mind', target: 10, unit: 'minutes', schedule: EVERY_DAY, p: 0.6, desc: '10 minutes of mindfulness' },
    { name: 'Deep work block', category: 'Productivity', target: 2, unit: 'hours', schedule: WEEKDAYS, p: 0.78, desc: 'No-distraction focus time' },
    { name: 'Track spending', category: 'Finance', target: 1, unit: '', schedule: EVERY_DAY, p: 0.55, desc: 'Log every expense' },
  ];
  const habits = defs.map((d, i) => ({
    id: uid(),
    name: d.name,
    description: d.desc,
    category: d.category,
    color: HABIT_COLORS[i].hex,
    target: d.target,
    unit: d.unit,
    schedule: d.schedule,
    createdAt: start,
    archivedAt: null,
    demo: true,
  }));

  const logs = {};
  const today = todayKey();
  for (let k = start, i = 0; k < today; k = addDays(k, 1), i++) {
    const dow = weekday(k);
    const weekendDip = dow === 0 || dow === 6 ? 0.12 : 0;
    const improvement = (i / 90) * 0.12; // gets better over time
    habits.forEach((h, idx) => {
      if (!h.schedule.includes(dow)) return;
      const p = defs[idx].p - weekendDip + improvement;
      const r = Math.random();
      let v = 0;
      if (r < p) v = h.target;
      else if (r < p + 0.15 && h.target > 1) v = Math.max(1, Math.floor(h.target * (0.3 + Math.random() * 0.5)));
      if (v > 0) (logs[k] ??= {})[h.id] = v;
    });
  }
  const notes = {
    [addDays(today, -1)]: 'Good energy today. Skipped meditation — try mornings instead.',
    [addDays(today, -3)]: 'Long workday, still got the workout in.',
  };

  // A few weeks of sample focus sessions so the Focus page and reports have data.
  const linkable = [habits[4].id, habits[3].id, null];
  const sessions = [];
  for (let back = 20; back >= 1; back--) {
    const key = addDays(today, -back);
    const count = [0, 1, 2, 2, 3, 4][Math.floor(Math.random() * 6)];
    for (let n = 0; n < count; n++) {
      const end = parseKey(key);
      end.setHours(9 + n, 30, 0, 0);
      sessions.push({
        id: uid(), date: key, minutes: 25, habitId: linkable[n % linkable.length], demo: true,
        startedAt: new Date(end - 25 * 60000).toISOString(), endedAt: end.toISOString(),
      });
    }
  }

  return {
    version: 1,
    habits,
    logs,
    notes,
    habitNotes: {
      [addDays(today, -1)]: { [habits[2].id]: 'Finished chapter 4 of Atomic Habits — the idea of habit stacking clicked.' },
      [addDays(today, -2)]: { [habits[1].id]: 'Legs day: squats 4×8, lunges, 10 min bike cool-down.' },
      [addDays(today, -4)]: { [habits[2].id]: 'Only managed 12 pages, too tired after work.', [habits[3].id]: 'Body scan before bed, felt calmer.' },
    },
    pomodoro: { settings: {}, active: null, sessions },
    demo: { loadedAt: new Date().toISOString(), notes },
  };
}

// ---------- demo data & clean sheet ----------

export const PREF_DEFAULTS = { showDemoShortcuts: true, demoBannerHidden: false };
export const getPrefs = (data) => ({ ...PREF_DEFAULTS, ...(data.prefs || {}) });
export const hasDemo = (data) => Boolean(data.demo) || data.habits.some((h) => h.demo);

/** Replace everything with sample data, keeping the user's preferences and timer settings. */
export function withDemo(data) {
  const demo = demoData();
  return {
    ...demo,
    pomodoro: { ...demo.pomodoro, settings: { ...(data.pomodoro?.settings || {}), habitId: null } },
    prefs: { ...(data.prefs || {}), demoBannerHidden: false },
  };
}

/**
 * Remove only the sample data: demo habits and their check-ins, demo notes (unless edited)
 * and demo focus sessions. Anything the user added while exploring is kept.
 */
export function removeDemo(data) {
  const ids = new Set(data.habits.filter((h) => h.demo).map((h) => h.id));
  const logs = {};
  for (const [key, day] of Object.entries(data.logs)) {
    const kept = Object.fromEntries(Object.entries(day).filter(([id]) => !ids.has(id)));
    if (Object.keys(kept).length) logs[key] = kept;
  }
  const habitNotes = stripHabitNotes(data.habitNotes, ids);
  const notes = { ...data.notes };
  for (const [key, text] of Object.entries(data.demo?.notes || {})) {
    if (notes[key] === text) delete notes[key];
  }
  const p = data.pomodoro || {};
  const unlink = (id) => (ids.has(id) ? null : id);
  return {
    ...data,
    habits: data.habits.filter((h) => !h.demo),
    logs,
    notes,
    habitNotes,
    pomodoro: {
      ...p,
      settings: { ...(p.settings || {}), habitId: unlink(p.settings?.habitId ?? null) },
      sessions: (p.sessions || []).filter((s) => !s.demo).map((s) => ({ ...s, habitId: unlink(s.habitId) })),
    },
    demo: null,
  };
}

/** Erase all habits, check-ins, notes and focus sessions. Preferences and timer settings stay. */
export function eraseAll(data) {
  return {
    version: 1,
    habits: [],
    logs: {},
    notes: {},
    habitNotes: {},
    pomodoro: { settings: { ...(data.pomodoro?.settings || {}), habitId: null }, active: null, sessions: [] },
    prefs: data.prefs || {},
    demo: null,
  };
}

// ---------- per-habit daily notes ----------
// Stored as habitNotes: { 'YYYY-MM-DD': { habitId: 'what I did…' } }

export const habitNoteFor = (data, habitId, date) => data.habitNotes?.[date]?.[habitId] ?? '';

export function setHabitNote(data, habitId, date, text) {
  const day = { ...(data.habitNotes?.[date] || {}) };
  if (text) day[habitId] = text;
  else delete day[habitId];
  const habitNotes = { ...(data.habitNotes || {}) };
  if (Object.keys(day).length) habitNotes[date] = day;
  else delete habitNotes[date];
  return { ...data, habitNotes };
}

/** All notes for one habit, newest first: [{ date, text }]. */
export const habitNoteHistory = (data, habitId) =>
  Object.entries(data.habitNotes || {})
    .filter(([, day]) => day[habitId])
    .map(([date, day]) => ({ date, text: day[habitId] }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

export function stripHabitNotes(habitNotes = {}, ids) {
  const out = {};
  for (const [date, day] of Object.entries(habitNotes)) {
    const kept = Object.fromEntries(Object.entries(day).filter(([id]) => !ids.has(id)));
    if (Object.keys(kept).length) out[date] = kept;
  }
  return out;
}
