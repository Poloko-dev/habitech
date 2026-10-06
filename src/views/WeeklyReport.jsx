import { useMemo, useState } from 'react';
import { Card, PageHead, PeriodNav, StatTile, Delta, Icon, Insights, RateBar, StatusCell, Segmented, Badge } from '../components/ui.jsx';
import { CompareColumns } from '../components/Charts.jsx';
import { FocusSummary } from '../components/FocusSummary.jsx';
import { rangeStats, insights, isScheduled, valueOf, pct, delta, scoreLabel } from '../lib/analytics.js';
import { todayKey, addDays, startOfWeek, endOfWeek, formatRange, formatLong, formatDow, parseKey } from '../lib/dates.js';

export function WeeklyReport({ data, anchor, setAnchor, openDay, openFocus }) {
  const today = todayKey();
  const start = startOfWeek(anchor);
  const end = endOfWeek(anchor);
  const isCurrent = start === startOfWeek(today);
  const [mode, setMode] = useState('chart');

  const r = useMemo(() => {
    const curr = rangeStats(data, start, end);
    const prev = rangeStats(data, addDays(start, -7), addDays(start, -1));
    return { curr, prev, notes: insights(curr, prev, 'week') };
  }, [data, start, end]);
  const { curr, prev } = r;

  const compare = curr.days.map((d, i) => {
    const p = prev.days[i];
    return {
      label: formatDow(d.key),
      tipTitle: `${formatDow(d.key)} · ${formatLong(d.key)}`,
      current: d.future || d.inProgress || !d.scheduled ? null : d.rate,
      currentDone: d.completed,
      currentSched: d.scheduled,
      previous: p.scheduled ? p.rate : null,
      previousDone: p.completed,
      previousSched: p.scheduled,
    };
  });

  const checkins = curr.completed;
  const best = [...curr.perHabit].sort((a, b) => b.rate - a.rate)[0];
  const habitsInWeek = data.habits.filter((h) => curr.days.some((d) => isScheduled(h, d.key)));

  const cellState = (h, key) => {
    if (!isScheduled(h, key)) return ['off', 'Not scheduled'];
    if (key > today) return ['future', 'Upcoming'];
    const v = valueOf(data, h.id, key);
    if (v >= h.target) return ['done', `Done (${v}/${h.target})`];
    if (v > 0) return ['partial', `Partial (${v}/${h.target})`];
    return ['missed', 'Missed'];
  };

  return (
    <>
      <PageHead title={formatRange(start, end)}
        sub={isCurrent ? 'This week so far — totals include completed days; today is added once it ends.' : 'Week in review, compared with the week before.'}>
        <PeriodNav label={isCurrent ? 'This week' : `Week of ${formatRange(start, end).split(' – ')[0]}`}
          onPrev={() => setAnchor(addDays(start, -7))} onNext={() => setAnchor(addDays(start, 7))}
          nextDisabled={isCurrent} onToday={() => setAnchor(today)} todayLabel="This week" />
        <button className="btn print-btn" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
      </PageHead>

      <div className="grid grid-4">
        <StatTile accent label="Weekly completion" value={pct(curr.rate)}
          foot={<Delta value={delta(curr.rate, prev.rate)} suffix="vs last week" />} />
        <StatTile label="Check-ins" value={checkins}
          foot={<Delta value={checkins - prev.completed} unit="" suffix="vs last week" />} />
        <StatTile label="Perfect days" value={`${curr.perfectDays}/${curr.activeDays}`}
          foot={<Badge tone={scoreLabel(curr.rate).tone}>{scoreLabel(curr.rate).label}</Badge>} />
        <StatTile label="Top habit" value={<span className="stat-text">{best?.habit.name ?? '—'}</span>}
          foot={best ? `${pct(best.rate)} · ${best.completed}/${best.scheduled} days` : ''} />
      </div>

      <div className="grid grid-3 mt">
        <Card className="span-2" title="Daily completion, this week vs last week"
          hint="Share of scheduled habits completed each day"
          action={<Segmented label="View as" value={mode} onChange={setMode}
            options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />}>
          {mode === 'chart' ? (
            <CompareColumns data={compare} currentName="This week" previousName="Last week" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Day</th><th className="num">This week</th><th className="num">Done</th><th className="num">Last week</th><th className="num">Done</th></tr></thead>
                <tbody>
                  {compare.map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td className="num">{pct(c.current)}</td>
                      <td className="num">{c.currentDone}/{c.currentSched}</td>
                      <td className="num">{pct(c.previous)}</td>
                      <td className="num">{c.previousDone}/{c.previousSched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Insights"><Insights items={r.notes} /></Card>
      </div>

      <Card className="mt" title="Habit × day" hint="Click a day header to open its daily report">
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th>Habit</th>
                {curr.days.map((d) => (
                  <th key={d.key} className="center">
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => openDay(d.key)}
                      disabled={d.key > today}>
                      {formatDow(d.key)} {parseKey(d.key).getDate()}
                    </button>
                  </th>
                ))}
                <th style={{ minWidth: 170 }}>Week rate</th>
              </tr>
            </thead>
            <tbody>
              {habitsInWeek.map((h) => {
                const ph = curr.perHabit.find((p) => p.habit.id === h.id);
                return (
                  <tr key={h.id}>
                    <td><span className="habit-name"><span className="swatch" style={{ background: h.color }} />{h.name}</span></td>
                    {curr.days.map((d) => {
                      const [state, title] = cellState(h, d.key);
                      return <td key={d.key} className="center"><StatusCell state={state} title={`${h.name}, ${formatLong(d.key)}: ${title}`} /></td>;
                    })}
                    <td>{ph?.scheduled ? <RateBar value={ph.rate} /> : <span className="muted small">Not started</span>}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="strong">Daily total</td>
                {curr.days.map((d) => (
                  <td key={d.key} className="center small strong">{d.future ? '—' : d.scheduled ? `${d.completed}/${d.scheduled}` : '·'}</td>
                ))}
                <td><RateBar value={curr.rate} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="legend mt">
          <span className="key"><StatusCell state="done" title="Done" /> Done</span>
          <span className="key"><StatusCell state="partial" title="Partial" /> Partial</span>
          <span className="key"><StatusCell state="missed" title="Missed" /> Missed</span>
          <span className="key"><StatusCell state="off" title="Not scheduled" /> Not scheduled</span>
          <span className="key"><StatusCell state="future" title="Upcoming" /> Upcoming</span>
        </div>
      </Card>

      <div className="mt">
        <FocusSummary data={data} start={start} end={end} prevStart={addDays(start, -7)} prevEnd={addDays(start, -1)}
          periodName="week" onOpen={openFocus} />
      </div>
    </>
  );
}
