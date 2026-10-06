import { eachDay, startOfMonth, endOfMonth, weekday, parseKey, todayKey, formatLong } from '../lib/dates.js';
import { pct } from '../lib/analytics.js';

// Sequential pink ramp: light = low completion, dark = high.
const RAMP = [
  { max: 0, bg: '#fdf0f5', fg: '#a8285a', label: '0%' },
  { max: 0.25, bg: '#f9d3e2', fg: '#a8285a', label: '1–25%' },
  { max: 0.5, bg: '#f0a1c0', fg: '#7a1d42', label: '26–50%' },
  { max: 0.75, bg: '#e46c98', fg: '#ffffff', label: '51–75%' },
  { max: 0.999, bg: '#d63f78', fg: '#ffffff', label: '76–99%' },
  { max: 1, bg: '#a8285a', fg: '#ffffff', label: '100%' },
];
const shade = (r) => RAMP.find((s) => r <= s.max) ?? RAMP[RAMP.length - 1];

/** Month calendar heatmap. statsByKey: { [key]: dayStats } */
export function MonthHeatmap({ monthKey, statsByKey, onSelect }) {
  const days = eachDay(startOfMonth(monthKey), endOfMonth(monthKey));
  const lead = (weekday(days[0]) + 6) % 7; // Monday-first offset
  const today = todayKey();

  return (
    <>
      <div className="heatmap" role="grid" aria-label="Daily completion calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="heat-cell blank" />)}
        {days.map((key) => {
          const s = statsByKey[key];
          const dayNum = parseKey(key).getDate();
          const isToday = key === today;
          let cls = 'heat-cell';
          let style = {};
          let title;
          if (key > today) {
            cls += ' future';
            title = `${formatLong(key)} — upcoming`;
          } else if (!s || s.scheduled === 0) {
            cls += ' none';
            title = `${formatLong(key)} — nothing scheduled`;
          } else {
            const sh = shade(s.rate);
            style = { background: sh.bg, color: sh.fg };
            title = `${formatLong(key)} — ${pct(s.rate)} (${s.completed}/${s.scheduled} habits)`;
          }
          if (isToday) cls += ' today';
          if (onSelect && key <= today) cls += ' selectable';
          return (
            <div key={key} className={cls} style={style} title={title} aria-label={title} role="gridcell"
              onClick={onSelect && key <= today ? () => onSelect(key) : undefined}>
              <span>{dayNum}</span>
              {s && s.scheduled > 0 && key <= today && <span className="pctv">{pct(s.rate)}</span>}
            </div>
          );
        })}
      </div>
      <div className="heat-legend">
        <span style={{ marginRight: 4 }}>Less</span>
        {RAMP.map((s) => <span key={s.label} className="sw" style={{ background: s.bg }} title={s.label} />)}
        <span style={{ marginLeft: 4 }}>More</span>
        <span className="sw" style={{ background: '#f4f5f8', marginLeft: 14 }} aria-hidden="true" />
        <span>No habits scheduled</span>
      </div>
    </>
  );
}
