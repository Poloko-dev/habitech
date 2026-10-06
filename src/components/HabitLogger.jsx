import { Icon, Badge } from './ui.jsx';
import { dayStats, streaks } from '../lib/analytics.js';

/** Sets a habit's logged value for a date (0 removes the entry). */
export function setLog(update, key, habitId, value) {
  update((d) => {
    const day = { ...(d.logs[key] || {}) };
    if (value > 0) day[habitId] = value;
    else delete day[habitId];
    const logs = { ...d.logs };
    if (Object.keys(day).length) logs[key] = day;
    else delete logs[key];
    return { ...d, logs };
  });
}

/** Check-off list for one date. Binary habits toggle; counted habits get −/+ steppers. */
export function HabitLogger({ data, update, dateKey, emptyText = 'No habits scheduled for this day.' }) {
  const { items } = dayStats(data, dateKey);
  if (!items.length) return <p className="muted">{emptyText}</p>;

  return (
    <div className="habit-list">
      {items.map(({ habit: h, value, done, progress }) => {
        const counted = h.target > 1;
        const streak = streaks(data, h, dateKey).current;
        return (
          <div key={h.id} className={`habit-row ${done ? 'done' : ''}`}>
            <button className={`check ${done ? 'on' : ''}`} aria-pressed={done}
              aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`}
              onClick={() => setLog(update, dateKey, h.id, done ? 0 : h.target)}>
              {done && <Icon name="check" size={16} stroke={3} />}
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="habit-name">
                <span className="swatch" style={{ background: h.color }} />
                {h.name}
              </div>
              <div className="habit-meta">
                <span>{h.category}</span>
                {counted && <span>Target {h.target} {h.unit}</span>}
                {streak > 0 && <span className="flame"><Icon name="flame" size={12} />{streak}-day streak</span>}
              </div>
              {counted && (
                <div className="mini-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
              )}
            </div>
            <div>
              {counted ? (
                <div className="counter">
                  <button className="icon-btn" aria-label={`Decrease ${h.name}`} disabled={value <= 0}
                    onClick={() => setLog(update, dateKey, h.id, Math.max(0, value - 1))}>
                    <Icon name="minus" size={16} />
                  </button>
                  <span className="val">{value}/{h.target}</span>
                  <button className="icon-btn" aria-label={`Increase ${h.name}`}
                    onClick={() => setLog(update, dateKey, h.id, value + 1)}>
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              ) : (
                <Badge tone={done ? 'pink' : 'muted'}>{done ? 'Done' : 'Pending'}</Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
