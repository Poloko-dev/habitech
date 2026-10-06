import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Badge } from './ui.jsx';
import { setLog } from './HabitLogger.jsx';
import { isScheduled, valueOf, rangeStats, streaks, pct } from '../lib/analytics.js';
import { scheduleLabel, habitNoteFor, setHabitNote, habitNoteHistory } from '../lib/habits.js';
import { focusInRange, formatMinutes } from '../lib/pomodoro.js';
import { todayKey, addDays, formatLong, formatShort, formatDow, parseKey } from '../lib/dates.js';

/** Click-through view of one habit: details, stats, progress + "what I did" for any day. */
export function HabitDetail({ data, update, habitId, onClose, onEdit }) {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const backdrop = useRef(null);
  const habit = data.habits.find((h) => h.id === habitId);

  // Escape closes this window only when it's the top-most one (the edit form can open over it).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const open = document.querySelectorAll('.modal-back');
      if (open[open.length - 1] === backdrop.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    if (!habit) return null;
    const yesterday = addDays(today, -1);
    const find = (r) => r.perHabit.find((p) => p.habit.id === habit.id);
    const last30 = find(rangeStats(data, addDays(today, -30), yesterday));
    const allTime = habit.createdAt <= yesterday ? find(rangeStats(data, habit.createdAt, yesterday)) : null;
    const focus = focusInRange(data, habit.createdAt, today).sessions.filter((s) => s.habitId === habit.id);
    return {
      ...streaks(data, habit, today),
      last30: last30?.rate ?? null,
      checkins: allTime?.completed ?? 0,
      focusMinutes: focus.reduce((n, s) => n + s.minutes, 0),
    };
  }, [data, habit, today]);

  if (!habit) return null; // deleted while open

  const value = valueOf(data, habit.id, date);
  const counted = habit.target > 1;
  const done = value >= habit.target;
  const scheduled = isScheduled(habit, date);
  const locked = Boolean(habit.archivedAt && date >= habit.archivedAt);
  const note = habitNoteFor(data, habit.id, date);
  const history = habitNoteHistory(data, habit.id);
  const minDate = habit.createdAt;
  const unit = habit.unit ? ` ${habit.unit}` : '';

  const log = (v) => setLog(update, date, habit.id, Math.max(0, Math.round(v * 100) / 100));
  const writeNote = (text) => update((d) => setHabitNote(d, habit.id, date, text));

  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((key) => {
    let state = 'off';
    let label = 'Not scheduled';
    if (key < habit.createdAt) [state, label] = ['before', 'Before this habit started'];
    else if (isScheduled(habit, key)) {
      const v = valueOf(data, habit.id, key);
      if (v >= habit.target) [state, label] = ['done', `Done (${v}/${habit.target})`];
      else if (v > 0) [state, label] = ['partial', `Partial (${v}/${habit.target})`];
      else if (key === today) [state, label] = ['today', 'Not done yet'];
      else [state, label] = ['missed', 'Missed'];
    }
    const hasNote = Boolean(habitNoteFor(data, habit.id, key));
    return { key, state, label, hasNote };
  });

  const dayName = date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : `on ${formatShort(date)}`;

  return (
    <div className="modal-back" ref={backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="habit-detail-title">
        <div className="modal-head detail-head">
          <div className="detail-title">
            <span className="detail-swatch" style={{ background: habit.color }} />
            <div>
              <h2 id="habit-detail-title">{habit.name}</h2>
              <div className="habit-meta">
                <Badge tone="navy">{habit.category}</Badge>
                {habit.demo && <Badge tone="pink">Demo</Badge>}
                {habit.archivedAt && <Badge tone="muted">Archived {formatShort(habit.archivedAt)}</Badge>}
              </div>
            </div>
          </div>
          <div className="head-actions" style={{ width: 'auto' }}>
            {!habit.archivedAt && (
              <button className="btn btn-sm" onClick={() => onEdit(habit)}><Icon name="edit" size={15} />Edit</button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
        </div>

        <div className="modal-body">
          {habit.description && <p className="detail-desc">{habit.description}</p>}
          <dl className="detail-facts">
            <div><dt>Schedule</dt><dd>{scheduleLabel(habit.schedule)}</dd></div>
            <div><dt>Daily target</dt><dd>{counted ? `${habit.target}${unit}` : 'Check off once'}</dd></div>
            <div><dt>Started</dt><dd>{formatShort(habit.createdAt)}</dd></div>
          </dl>

          <div className="mini-stats">
            <div><span>Current streak</span><b className="flame"><Icon name="flame" size={15} />{stats.current} d</b></div>
            <div><span>Best streak</span><b>{stats.longest} d</b></div>
            <div><span>Last 30 days</span><b>{pct(stats.last30)}</b></div>
            <div><span>Check-ins</span><b>{stats.checkins}</b></div>
            {stats.focusMinutes > 0 && <div><span>Focus time</span><b>{formatMinutes(stats.focusMinutes)}</b></div>}
          </div>

          {/* Progress for the selected day */}
          <section className="progress-box" aria-labelledby="progress-title">
            <div className="progress-head">
              <h3 id="progress-title">Progress {dayName}</h3>
              <div className="period-nav">
                <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} disabled={date <= minDate} aria-label="Previous day">
                  <Icon name="left" size={16} />
                </button>
                <input type="date" className="input" value={date} min={minDate} max={today} aria-label="Pick a day"
                  onChange={(e) => e.target.value && e.target.value >= minDate && e.target.value <= today && setDate(e.target.value)} />
                <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
                  <Icon name="right" size={16} />
                </button>
              </div>
            </div>

            {locked ? (
              <p className="muted small">This habit was archived on {formatShort(habit.archivedAt)} — restore it to keep logging.</p>
            ) : (
              <>
                {!scheduled && (
                  <p className="muted small">Not scheduled {dayName}. You can still log it — it won’t affect your completion rate.</p>
                )}
                {counted ? (
                  <div className="progress-row">
                    <div className="counter">
                      <button className="icon-btn" onClick={() => log(value - 1)} disabled={value <= 0} aria-label="Decrease"><Icon name="minus" size={16} /></button>
                      <ValueInput value={value} onCommit={log} label={`${habit.name} amount`} />
                      <button className="icon-btn" onClick={() => log(value + 1)} aria-label="Increase"><Icon name="plus" size={16} /></button>
                    </div>
                    <div className="progress-meter">
                      <div className="progress-text">
                        <b>{value}</b> of {habit.target}{unit}
                        {done && <Badge tone="good">✓ Target reached</Badge>}
                      </div>
                      <div className="mini-progress"><span style={{ width: `${Math.min(1, value / habit.target) * 100}%` }} /></div>
                    </div>
                    {!done && <button className="btn btn-sm" onClick={() => log(habit.target)}>Complete</button>}
                  </div>
                ) : (
                  <button className={`done-toggle ${done ? 'on' : ''}`} aria-pressed={done} onClick={() => log(done ? 0 : 1)}>
                    <span className="check-ico">{done && <Icon name="check" size={16} stroke={3} />}</span>
                    {done ? `Done ${dayName}` : `Mark as done ${dayName}`}
                  </button>
                )}
              </>
            )}

            <div className="field">
              <label htmlFor="habit-note">What did you do?</label>
              <textarea id="habit-note" className="textarea" value={note} maxLength={2000}
                placeholder={`e.g. what you did for “${habit.name}” ${dayName}, how it went, what got in the way…`}
                onChange={(e) => writeNote(e.target.value)} />
              <span className="muted small">Saved automatically to storage.json.</span>
            </div>
          </section>

          <section>
            <h3 className="section-title">Last 14 days</h3>
            <div className="day-strip" role="list">
              {strip.map((d) => (
                <button key={d.key} role="listitem" className={`day-cell ${d.state} ${d.key === date ? 'selected' : ''}`}
                  onClick={() => d.state !== 'before' && setDate(d.key)} disabled={d.state === 'before'}
                  title={`${formatLong(d.key)} — ${d.label}${d.hasNote ? ' · has a note' : ''}`}
                  aria-label={`${formatLong(d.key)}: ${d.label}${d.hasNote ? ', has a note' : ''}`}>
                  <span className="dow">{formatDow(d.key).slice(0, 2)}</span>
                  <span className="dot">{d.state === 'done' && <Icon name="check" size={11} stroke={3.5} />}</span>
                  <span className="num">{parseKey(d.key).getDate()}</span>
                  {d.hasNote && <span className="note-dot" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="section-title">Recent notes</h3>
            {history.length ? (
              <ul className="note-list">
                {history.slice(0, 6).map((n) => (
                  <li key={n.date}>
                    <button onClick={() => setDate(n.date)} className={n.date === date ? 'selected' : ''}>
                      <span className="note-date">{formatShort(n.date)} · {formatDow(n.date)}</span>
                      <span className="note-text">{n.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No notes yet. Write what you did in the box above — it’s saved per day.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Direct numeric entry that doesn't fight the user while typing. */
function ValueInput({ value, onCommit, label }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n) && n >= 0) onCommit(n);
    else setDraft(String(value));
  };
  return (
    <input className="input value-input" type="number" min="0" step="any" inputMode="decimal" aria-label={label}
      value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  );
}
