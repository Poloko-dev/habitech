// All dates are handled as local-time "YYYY-MM-DD" keys.

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

export const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

export const addMonths = (key, n) => {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/** Weeks start on Monday. */
export const startOfWeek = (key) => {
  const dow = parseKey(key).getDay(); // 0 = Sun
  return addDays(key, -((dow + 6) % 7));
};
export const endOfWeek = (key) => addDays(startOfWeek(key), 6);

export const startOfMonth = (key) => {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
};
export const endOfMonth = (key) => {
  const d = parseKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

export const eachDay = (start, end) => {
  const out = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
};

export const weekday = (key) => parseKey(key).getDay();

export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);

const fmt = (opts) => new Intl.DateTimeFormat(undefined, opts);
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fShort = fmt({ day: 'numeric', month: 'short' });
const fMonth = fmt({ month: 'long', year: 'numeric' });
const fDow = fmt({ weekday: 'short' });

export const formatLong = (key) => fLong.format(parseKey(key));
export const formatShort = (key) => fShort.format(parseKey(key));
export const formatMonth = (key) => fMonth.format(parseKey(key));
export const formatDow = (key) => fDow.format(parseKey(key));
export const formatRange = (a, b) => `${formatShort(a)} – ${formatShort(b)}`;

// Monday-first ordering for weekday displays (values are JS getDay() numbers).
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
