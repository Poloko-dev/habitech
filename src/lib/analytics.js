import { addDays, eachDay, weekday, todayKey, diffDays, WEEK_ORDER, DOW_NAMES } from './dates.js';

// ---------- primitives ----------

/** A habit counts on a date if it existed then, wasn't archived yet, and is scheduled that weekday. */
export function isScheduled(habit, key) {
  if (key < habit.createdAt) return false;
  if (habit.archivedAt && key >= habit.archivedAt) return false;
  return habit.schedule.includes(weekday(key));
}

export const valueOf = (data, habitId, key) => data.logs[key]?.[habitId] ?? 0;

export const isDone = (data, habit, key) => valueOf(data, habit.id, key) >= habit.target;

/** Partial credit (0..1) – used for "progress", completion rates use isDone. */
export const progressOf = (data, habit, key) =>
  Math.min(1, valueOf(data, habit.id, key) / Math.max(1, habit.target));

export const rate = (done, total) => (total > 0 ? done / total : null);

export const pct = (r, digits = 0) => (r == null ? '—' : `${(r * 100).toFixed(digits)}%`);

// ---------- per-day ----------

export function dayStats(data, key) {
  const items = data.habits
    .filter((h) => isScheduled(h, key))
    .map((h) => ({
      habit: h,
      value: valueOf(data, h.id, key),
      done: isDone(data, h, key),
      progress: progressOf(data, h, key),
    }));
  const completed = items.filter((i) => i.done).length;
  return { key, items, scheduled: items.length, completed, rate: rate(completed, items.length) };
}

// ---------- ranges ----------

/**
 * Stats over [start, end]. Future days are excluded, and today is treated as
 * in progress (shown, but not counted) so unfinished habits don't read as misses.
 */
export function rangeStats(data, start, end) {
  const today = todayKey();
  const days = eachDay(start, end).map((key) => ({
    ...dayStats(data, key),
    future: key > today,
    inProgress: key === today,
  }));
  const counted = days.filter((d) => !d.future && !d.inProgress);

  const scheduled = counted.reduce((s, d) => s + d.scheduled, 0);
  const completed = counted.reduce((s, d) => s + d.completed, 0);
  const perfectDays = counted.filter((d) => d.scheduled > 0 && d.completed === d.scheduled).length;
  const activeDays = counted.filter((d) => d.scheduled > 0).length;

  const perHabit = data.habits
    .map((h) => {
      let sched = 0;
      let done = 0;
      let total = 0;
      let bestRun = 0;
      let run = 0;
      for (const d of counted) {
        if (!isScheduled(h, d.key)) continue;
        sched += 1;
        total += valueOf(data, h.id, d.key);
        if (isDone(data, h, d.key)) {
          done += 1;
          run += 1;
          bestRun = Math.max(bestRun, run);
        } else {
          run = 0;
        }
      }
      return { habit: h, scheduled: sched, completed: done, rate: rate(done, sched), total, bestRun };
    })
    .filter((p) => p.scheduled > 0);

  return {
    start,
    end,
    days,
    scheduled,
    completed,
    rate: rate(completed, scheduled),
    perfectDays,
    activeDays,
    perHabit,
  };
}

/** Completion rate per weekday (Monday first) across a range. */
export function weekdayPerformance(stats) {
  const buckets = Object.fromEntries(WEEK_ORDER.map((d) => [d, { done: 0, total: 0 }]));
  for (const d of stats.days) {
    if (d.future || d.inProgress) continue;
    const b = buckets[weekday(d.key)];
    b.done += d.completed;
    b.total += d.scheduled;
  }
  return WEEK_ORDER.map((dow) => ({
    dow,
    label: DOW_NAMES[dow].slice(0, 3),
    name: DOW_NAMES[dow],
    rate: rate(buckets[dow].done, buckets[dow].total),
    completed: buckets[dow].done,
    scheduled: buckets[dow].total,
  }));
}

// ---------- streaks ----------

/**
 * Current & longest streak of consecutive *scheduled* days completed, as of `asOf`.
 * Unscheduled days are skipped (they don't break a streak). If `asOf` itself is
 * scheduled but not yet done, the current streak counts from the day before
 * (the day isn't over yet).
 */
export function streaks(data, habit, asOf = todayKey()) {
  let current = 0;
  let k = asOf;
  if (isScheduled(habit, k) && !isDone(data, habit, k)) k = addDays(k, -1);
  while (k >= habit.createdAt) {
    if (isScheduled(habit, k)) {
      if (!isDone(data, habit, k)) break;
      current += 1;
    }
    k = addDays(k, -1);
  }

  let longest = 0;
  let run = 0;
  for (let d = habit.createdAt; d <= asOf; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    if (isDone(data, habit, d)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { current, longest: Math.max(longest, current) };
}

// ---------- comparisons & insights ----------

export function delta(curr, prev) {
  if (curr == null || prev == null) return null;
  return curr - prev; // in rate units (0..1) -> percentage points
}

export function scoreLabel(r) {
  if (r == null) return { label: 'No data', tone: 'muted' };
  if (r >= 0.9) return { label: 'Excellent', tone: 'good' };
  if (r >= 0.75) return { label: 'Strong', tone: 'good' };
  if (r >= 0.5) return { label: 'Building', tone: 'warn' };
  return { label: 'Needs focus', tone: 'bad' };
}

/** Plain-language findings for a report period. */
export function insights(stats, prevStats, periodName) {
  const out = [];
  if (stats.scheduled === 0) return ['No habits were scheduled in this period yet.'];

  const d = delta(stats.rate, prevStats?.rate);
  if (d != null) {
    const pts = Math.round(Math.abs(d) * 100);
    if (pts === 0) out.push(`Completion held steady compared with the previous ${periodName}.`);
    else
      out.push(
        `Completion is ${d > 0 ? 'up' : 'down'} ${pts} percentage point${pts === 1 ? '' : 's'} vs the previous ${periodName} (${pct(prevStats.rate)} → ${pct(stats.rate)}).`,
      );
  }

  const ranked = [...stats.perHabit].sort((a, b) => b.rate - a.rate || b.completed - a.completed);
  if (ranked.length > 1) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    out.push(`Most consistent: ${best.habit.name} at ${pct(best.rate)} (${best.completed}/${best.scheduled}).`);
    if (worst.rate < best.rate)
      out.push(`Needs attention: ${worst.habit.name} at ${pct(worst.rate)} — ${worst.scheduled - worst.completed} missed.`);
  } else if (ranked.length === 1) {
    out.push(`${ranked[0].habit.name}: ${ranked[0].completed} of ${ranked[0].scheduled} scheduled days completed.`);
  }

  const wd = weekdayPerformance(stats).filter((w) => w.rate != null);
  if (wd.length > 2) {
    const sorted = [...wd].sort((a, b) => b.rate - a.rate);
    const top = sorted[0];
    const low = sorted[sorted.length - 1];
    if (top.rate - low.rate >= 0.1)
      out.push(`${top.name}s are your strongest day (${pct(top.rate)}); ${low.name}s are the weakest (${pct(low.rate)}).`);
  }

  if (stats.perfectDays > 0)
    out.push(`${stats.perfectDays} perfect day${stats.perfectDays === 1 ? '' : 's'} out of ${stats.activeDays} with habits scheduled.`);

  const missedRun = longestMissStreak(stats);
  if (missedRun >= 3) out.push(`Longest stretch of days below 50%: ${missedRun} days — plan a reset for days like these.`);

  return out;
}

function longestMissStreak(stats) {
  let run = 0;
  let best = 0;
  for (const d of stats.days) {
    if (d.future || d.inProgress || d.scheduled === 0) continue;
    if (d.rate < 0.5) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

/** Overall streak: consecutive days (ending today/yesterday) where every scheduled habit was done. */
export function perfectDayStreak(data, asOf = todayKey()) {
  let n = 0;
  let k = asOf;
  const today = dayStats(data, k);
  if (today.scheduled > 0 && today.completed < today.scheduled) k = addDays(k, -1);
  const earliest = data.habits.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), asOf);
  while (k >= earliest) {
    const s = dayStats(data, k);
    if (s.scheduled > 0) {
      if (s.completed < s.scheduled) break;
      n += 1;
    }
    k = addDays(k, -1);
  }
  return n;
}

export const daysTracked = (data) => {
  const first = data.habits.reduce((m, h) => (!m || h.createdAt < m ? h.createdAt : m), null);
  return first ? diffDays(first, todayKey()) + 1 : 0;
};
