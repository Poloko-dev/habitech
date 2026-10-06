import { useMemo, useState } from 'react';
import { Card, PageHead, PeriodNav, StatTile, Delta, Icon, Insights, RateBar, Segmented, Badge } from '../components/ui.jsx';
import { TrendChart, RateColumns } from '../components/Charts.jsx';
import { MonthHeatmap } from '../components/Heatmap.jsx';
import { FocusSummary, dayOfMonthLabel } from '../components/FocusSummary.jsx';
import { rangeStats, insights, weekdayPerformance, pct, delta, rate, scoreLabel } from '../lib/analytics.js';
import {
  todayKey, addMonths, startOfMonth, endOfMonth, formatMonth, formatShort, formatLong, parseKey, startOfWeek, addDays,
} from '../lib/dates.js';

export function MonthlyReport({ data, anchor, setAnchor, openDay, openFocus }) {
  const today = todayKey();
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  const isCurrent = start === startOfMonth(today);
  const [trendMode, setTrendMode] = useState('chart');

  const r = useMemo(() => {
    const curr = rangeStats(data, start, end);
    const prevStart = addMonths(start, -1);
    const prev = rangeStats(data, prevStart, endOfMonth(prevStart));

    // Week-by-week (Mon–Sun weeks overlapping this month, clipped to the month).
    const weeks = [];
    for (let ws = startOfWeek(start); ws <= end; ws = addDays(ws, 7)) {
      const days = curr.days.filter((d) => d.key >= ws && d.key <= addDays(ws, 6) && !d.future && !d.inProgress);
      const done = days.reduce((s, d) => s + d.completed, 0);
      const sched = days.reduce((s, d) => s + d.scheduled, 0);
      const first = ws < start ? start : ws;
      const lastDay = addDays(ws, 6) > end ? end : addDays(ws, 6);
      weeks.push({
        label: `Wk ${weeks.length + 1}`,
        tipTitle: `${formatShort(first)} – ${formatShort(lastDay)}`,
        rate: rate(done, sched),
        completed: done,
        scheduled: sched,
      });
    }
    return {
      curr,
      prev,
      weeks,
      weekdays: weekdayPerformance(curr).map((w) => ({ ...w, tipTitle: `${w.name}s` })),
      notes: insights(curr, prev, 'month'),
      byKey: Object.fromEntries(curr.days.map((d) => [d.key, d])),
    };
  }, [data, start, end]);
  const { curr, prev } = r;

  const trend = curr.days.map((d) => ({
    label: String(parseKey(d.key).getDate()),
    tipTitle: formatLong(d.key),
    rate: d.future || d.inProgress || !d.scheduled ? null : d.rate,
    completed: d.completed,
    scheduled: d.scheduled,
  }));
  const perHabit = [...curr.perHabit].sort((a, b) => b.rate - a.rate);
  const best = perHabit[0];
  const longestRun = perHabit.reduce((m, p) => (p.bestRun > (m?.bestRun ?? 0) ? p : m), null);
  const prevByHabit = Object.fromEntries(prev.perHabit.map((p) => [p.habit.id, p]));
  const dayCount = curr.days.filter((d) => !d.future && !d.inProgress).length;

  return (
    <>
      <PageHead title={formatMonth(start)}
        sub={isCurrent ? `Month to date — ${dayCount} completed day${dayCount === 1 ? '' : 's'} counted; today is added once it ends.` : 'Month in review, compared with the month before.'}>
        <PeriodNav label={formatMonth(start)} onPrev={() => setAnchor(addMonths(start, -1))}
          onNext={() => setAnchor(addMonths(start, 1))} nextDisabled={isCurrent}
          onToday={() => setAnchor(today)} todayLabel="This month" />
        <button className="btn print-btn" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
      </PageHead>

      <div className="grid grid-4">
        <StatTile accent label="Monthly completion" value={pct(curr.rate)}
          foot={<Delta value={delta(curr.rate, prev.rate)} suffix={`vs ${formatMonth(addMonths(start, -1)).split(' ')[0]}`} />} />
        <StatTile label="Check-ins" value={curr.completed.toLocaleString()}
          foot={`of ${curr.scheduled.toLocaleString()} scheduled`} />
        <StatTile label="Perfect days" value={`${curr.perfectDays}/${curr.activeDays}`}
          foot={<Badge tone={scoreLabel(curr.rate).tone}>{scoreLabel(curr.rate).label}</Badge>} />
        <StatTile label="Longest streak this month" value={longestRun ? `${longestRun.bestRun} d` : '—'}
          foot={longestRun?.habit.name ?? ''} />
      </div>

      <div className="grid grid-3 mt">
        <Card className="span-2" title="Daily calendar" hint="Completion rate per day · click a day to open its report">
          <MonthHeatmap monthKey={start} statsByKey={r.byKey} onSelect={openDay} />
        </Card>
        <Card title="Insights"><Insights items={r.notes} /></Card>
      </div>

      <Card className="mt" title="Daily completion rate" hint={`Blue line = monthly average (${pct(curr.rate)})`}
        action={<Segmented label="View as" value={trendMode} onChange={setTrendMode}
          options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />}>
        {trendMode === 'chart' ? (
          <TrendChart data={trend} average={curr.rate} />
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table className="table">
              <thead><tr><th>Date</th><th className="num">Completed</th><th className="num">Scheduled</th><th className="num">Rate</th></tr></thead>
              <tbody>
                {curr.days.filter((d) => !d.future && !d.inProgress).map((d) => (
                  <tr key={d.key}>
                    <td>{formatLong(d.key)}</td>
                    <td className="num">{d.completed}</td>
                    <td className="num">{d.scheduled}</td>
                    <td className="num">{pct(d.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-2 mt">
        <Card title="Completion by weekday" hint="Which days of the week you follow through · best day highlighted">
          <RateColumns data={r.weekdays} />
        </Card>
        <Card title="Week by week" hint="Completion rate for each week of the month">
          <RateColumns data={r.weeks} />
        </Card>
      </div>

      <Card className="mt" title="Habit performance" hint="Sorted by completion rate · change vs previous month in percentage points">
        {perHabit.length ? (
          <div className="table-wrap">
            <table className="table stacked">
              <thead>
                <tr>
                  <th>Habit</th>
                  <th style={{ minWidth: 180 }}>Completion</th>
                  <th className="num">Days done</th>
                  <th className="num">Missed</th>
                  <th className="num">Total logged</th>
                  <th className="num">Best streak</th>
                  <th className="num">vs last month</th>
                </tr>
              </thead>
              <tbody>
                {perHabit.map((p) => {
                  const pv = prevByHabit[p.habit.id];
                  return (
                    <tr key={p.habit.id}>
                      <td className="cell-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="habit-name"><span className="swatch" style={{ background: p.habit.color }} />{p.habit.name}</span>
                          {p === best && perHabit.length > 1 && <Badge tone="pink">Top habit</Badge>}
                        </div>
                      </td>
                      <td className="cell-wide" data-label="Completion"><RateBar value={p.rate} /></td>
                      <td className="num" data-label="Days done">{p.completed}/{p.scheduled}</td>
                      <td className="num" data-label="Missed">{p.scheduled - p.completed}</td>
                      <td className="num" data-label="Total logged">{p.total.toLocaleString()}{p.habit.unit ? ` ${p.habit.unit}` : ''}</td>
                      <td className="num" data-label="Best streak">{p.bestRun} d</td>
                      <td className="num" data-label="vs last month"><span className="stat-foot" style={{ justifyContent: 'flex-end', margin: 0 }}>
                        <Delta value={delta(p.rate, pv?.rate)} suffix="" />
                      </span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No habits were scheduled this month.</p>}
      </Card>

      <div className="mt">
        <FocusSummary data={data} start={start} end={end} prevStart={addMonths(start, -1)}
          prevEnd={endOfMonth(addMonths(start, -1))} periodName="month" labelFor={dayOfMonthLabel} onOpen={openFocus} />
      </div>
    </>
  );
}
