import { useMemo } from 'react';
import { Card, PageHead, PeriodNav, StatTile, Delta, Icon, Badge, Insights } from '../components/ui.jsx';
import { HabitLogger } from '../components/HabitLogger.jsx';
import { TrendChart } from '../components/Charts.jsx';
import { FocusDay } from '../components/FocusSummary.jsx';
import { dayStats, rangeStats, streaks, pct, delta, scoreLabel } from '../lib/analytics.js';
import { todayKey, addDays, formatLong, formatShort, startOfWeek } from '../lib/dates.js';

export function DailyReport({ data, update, date, setDate, openFocus }) {
  const today = todayKey();

  const r = useMemo(() => {
    const day = dayStats(data, date);
    const prev = dayStats(data, addDays(date, -1));
    const last7 = rangeStats(data, addDays(date, -7), addDays(date, -1));
    const last14 = rangeStats(data, addDays(date, -13), date);
    const weekSoFar = rangeStats(data, startOfWeek(date), date);
    const rows = day.items.map((i) => ({ ...i, ...streaks(data, i.habit, date) }));
    return { day, prev, last7, last14, weekSoFar, rows };
  }, [data, date]);

  const { day, prev, last7, last14, weekSoFar, rows } = r;
  const score = scoreLabel(day.rate);
  const note = data.notes?.[date] ?? '';
  const setNote = (text) =>
    update((d) => {
      const notes = { ...(d.notes || {}) };
      if (text) notes[date] = text;
      else delete notes[date];
      return { ...d, notes };
    });

  const missed = rows.filter((x) => !x.done);
  const findings = [];
  if (day.scheduled === 0) findings.push('No habits were scheduled on this day.');
  else {
    findings.push(`${day.completed} of ${day.scheduled} scheduled habits completed (${pct(day.rate)}).`);
    const d = delta(day.rate, prev.rate);
    if (d != null) findings.push(`${d >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(d * 100))} pts from the previous day (${pct(prev.rate)}).`);
    if (last7.rate != null) {
      const vsAvg = day.rate - last7.rate;
      findings.push(`${vsAvg >= 0 ? 'Above' : 'Below'} the prior 7-day average of ${pct(last7.rate)}.`);
    }
    if (missed.length) findings.push(`Missed: ${missed.map((m) => m.habit.name).join(', ')}.`);
    const longStreak = [...rows].sort((a, b) => b.current - a.current)[0];
    if (longStreak?.current >= 3) findings.push(`${longStreak.habit.name} is on a ${longStreak.current}-day streak.`);
  }

  const trend = last14.days.map((d) => ({
    label: formatShort(d.key),
    tipTitle: formatLong(d.key),
    rate: d.scheduled && !d.inProgress ? d.rate : null,
    completed: d.completed,
    scheduled: d.scheduled,
    highlight: d.key === date,
  }));

  return (
    <>
      <PageHead title={formatLong(date)} sub="What got done, what slipped, and how the day compares.">
        <PeriodNav label={date === today ? 'Today' : formatShort(date)} onPrev={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))} nextDisabled={date >= today} onToday={() => setDate(today)} />
        <input type="date" className="input" style={{ width: 160 }} value={date} max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
        <button className="btn print-btn" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
      </PageHead>

      <div className="grid grid-4">
        <StatTile accent label="Completion" value={pct(day.rate)}
          foot={<Delta value={delta(day.rate, prev.rate)} suffix="vs previous day" />} />
        <StatTile label="Habits completed" value={`${day.completed}/${day.scheduled}`}
          foot={<Badge tone={score.tone}>{score.label}</Badge>} />
        <StatTile label="Prior 7-day average" value={pct(last7.rate)} foot={`${last7.completed}/${last7.scheduled} check-ins`} />
        <StatTile label="Week to date" value={pct(weekSoFar.rate)} foot={`${weekSoFar.perfectDays} perfect day${weekSoFar.perfectDays === 1 ? '' : 's'}`} />
      </div>

      <div className="grid grid-3 mt">
        <div className="span-2 stack">
          <Card title="Habit log" hint={date === today ? 'Check off as you go' : 'Edit to back-fill a missed entry'}>
            <HabitLogger data={data} update={update} dateKey={date} />
          </Card>
          <Card title="Habit breakdown">
            {rows.length ? (
              <div className="table-wrap">
                <table className="table stacked">
                  <thead>
                    <tr><th>Habit</th><th>Status</th><th className="num">Logged</th><th className="num">Current streak</th><th className="num">Best streak</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.habit.id}>
                        <td className="cell-title"><span className="habit-name"><span className="swatch" style={{ background: x.habit.color }} />{x.habit.name}</span></td>
                        <td data-label="Status">
                          {x.done ? <Badge tone="good">✓ Done</Badge>
                            : x.value > 0 ? <Badge tone="warn">◐ Partial</Badge>
                              : <Badge tone="bad">✕ Missed</Badge>}
                        </td>
                        <td className="num" data-label="Logged">{x.value}/{x.habit.target}{x.habit.unit ? ` ${x.habit.unit}` : ''}</td>
                        <td className="num" data-label="Current streak">{x.current} d</td>
                        <td className="num" data-label="Best streak">{x.longest} d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted">Nothing scheduled.</p>}
          </Card>
        </div>
        <div className="stack">
          <Card title="Summary"><Insights items={findings} /></Card>
          <Card title="Journal note" hint="Saved with this day in storage.json">
            <textarea className="textarea" value={note} placeholder="How did today go? What got in the way?"
              onChange={(e) => setNote(e.target.value)} />
          </Card>
          <FocusDay data={data} date={date} onOpen={openFocus} />
        </div>
      </div>

      <Card className="mt" title="Completion rate, 14 days ending this day" hint={`Selected day marked with a dot · blue line = 14-day average (${pct(last14.rate)})`}>
        <TrendChart data={trend} average={last14.rate} />
      </Card>
    </>
  );
}
