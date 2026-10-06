import { useMemo } from 'react';
import { Card, PageHead, ProgressRing, StatTile, Icon, Delta } from '../components/ui.jsx';
import { HabitLogger } from '../components/HabitLogger.jsx';
import { TrendChart } from '../components/Charts.jsx';
import { dayStats, rangeStats, streaks, perfectDayStreak, pct, delta, daysTracked } from '../lib/analytics.js';
import { todayKey, addDays, formatLong, formatShort } from '../lib/dates.js';

export function Today({ data, update, onAddHabit, onLoadDemo, go }) {
  const today = todayKey();
  const active = data.habits.filter((h) => !h.archivedAt);

  const view = useMemo(() => {
    const t = dayStats(data, today);
    const last30 = rangeStats(data, addDays(today, -30), addDays(today, -1));
    const prev30 = rangeStats(data, addDays(today, -60), addDays(today, -31));
    const last14 = rangeStats(data, addDays(today, -14), addDays(today, -1));
    const streakRows = active
      .map((h) => ({ habit: h, ...streaks(data, h, today) }))
      .sort((a, b) => b.current - a.current || b.longest - a.longest);
    const totalCheckins = Object.values(data.logs).reduce(
      (n, day) => n + Object.entries(day).filter(([id, v]) => {
        const h = data.habits.find((x) => x.id === id);
        return h && v >= h.target;
      }).length,
      0,
    );
    return { t, last30, prev30, last14, streakRows, perfect: perfectDayStreak(data, today), totalCheckins };
  }, [data, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active.length) {
    return (
      <>
        <PageHead eyebrow="Today" title={formatLong(today)} />
        <div className="empty-wrap">
          <div className="empty">
            <h2>Start your first habit</h2>
            <p>Add the habits you want to build. Every check-in is saved and feeds your daily, weekly and monthly reports.</p>
            <div className="head-actions">
              <button className="btn btn-primary" onClick={onAddHabit}><Icon name="plus" size={16} />Add a habit</button>
              {onLoadDemo && <button className="btn" onClick={onLoadDemo}>Load 90 days of demo data</button>}
            </div>
          </div>
        </div>
      </>
    );
  }

  const { t, last30, prev30, last14, streakRows, perfect, totalCheckins } = view;
  const remaining = t.scheduled - t.completed;
  const trend = last14.days.map((d) => ({
    label: formatShort(d.key),
    tipTitle: formatLong(d.key),
    rate: d.scheduled ? d.rate : null,
    completed: d.completed,
    scheduled: d.scheduled,
    highlight: d.key === addDays(today, -1),
  }));

  return (
    <>
      <PageHead eyebrow="Today" title={formatLong(today)} sub="Check off your habits as you go — progress saves automatically.">
        <button className="btn btn-primary" onClick={onAddHabit}><Icon name="plus" size={16} />New habit</button>
      </PageHead>

      <div className="hero">
        <ProgressRing value={t.rate} label={pct(t.rate)} sub="today" />
        <div>
          <div className="hero-figure">{t.completed}<span style={{ fontSize: 28, color: 'var(--muted)' }}> / {t.scheduled}</span></div>
          <div className="hero-label">
            {t.scheduled === 0 ? 'Nothing scheduled today — enjoy the rest day.'
              : remaining === 0 ? 'Perfect day! Every habit is done.'
                : `${remaining} habit${remaining === 1 ? '' : 's'} left today`}
          </div>
        </div>
        <div className="hero-side">
          <div>
            <div className="stat-label">Perfect-day streak</div>
            <div className="stat-value"><span className="flame"><Icon name="flame" size={22} />{perfect}</span></div>
          </div>
          <div>
            <div className="stat-label">Days tracked</div>
            <div className="stat-value">{daysTracked(data)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-3 mt">
        <div className="span-2 stack">
          <Card title="Today's habits" hint={`${t.scheduled} scheduled · tap to complete`}>
            <HabitLogger data={data} update={update} dateKey={today} emptyText="No habits scheduled today." />
          </Card>
          <Card title="Completion rate, last 14 days" hint={`Share of scheduled habits completed per day · blue line = average (${pct(last14.rate)})`}
            action={<button className="btn btn-sm" onClick={() => go('daily')}>Daily report</button>}>
            <TrendChart data={trend} height={220} average={last14.rate} />
          </Card>
        </div>
        <div className="stack">
          <StatTile accent label="30-day completion" value={pct(last30.rate)}
            foot={<Delta value={delta(last30.rate, prev30.rate)} suffix="vs prior 30 days" />} />
          <div className="grid grid-2">
            <StatTile label="Perfect days (30d)" value={last30.perfectDays} foot={`of ${last30.activeDays} days`} />
            <StatTile label="Total check-ins" value={totalCheckins.toLocaleString()} foot="all time" />
          </div>
          <Card title="Streaks" hint="Consecutive scheduled days completed">
            <div className="streak-list">
              {streakRows.map(({ habit: h, current, longest }) => (
                <div key={h.id} className="streak-item">
                  <span className="habit-name" style={{ fontWeight: 500 }}>
                    <span className="swatch" style={{ background: h.color }} />{h.name}
                  </span>
                  <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="flame" title="Current streak"><Icon name="flame" size={14} />{current}</span>
                    <span className="muted small" title="Longest streak">best {longest}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
