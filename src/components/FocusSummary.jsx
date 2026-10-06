import { Card } from './ui.jsx';
import { MinutesColumns } from './Charts.jsx';
import { SessionList } from '../views/Focus.jsx';
import { focusInRange, formatMinutes } from '../lib/pomodoro.js';
import { formatLong, formatDow, parseKey, todayKey, addDays, diffDays } from '../lib/dates.js';

/** Focus (Pomodoro) time for a report period, compared with the previous period. */
export function FocusSummary({ data, start, end, prevStart, prevEnd, periodName, labelFor, onOpen }) {
  const curr = focusInRange(data, start, end);
  // For the period in progress, compare against the same number of days of the previous one.
  const today = todayKey();
  const inProgress = today >= start && today < end;
  const prevCut = inProgress ? addDays(prevStart, diffDays(start, today)) : prevEnd;
  const prev = focusInRange(data, prevStart, prevCut < prevEnd ? prevCut : prevEnd);
  const currToDate = inProgress ? focusInRange(data, start, today) : curr;
  const diff = currToDate.minutes - prev.minutes;
  const avg = curr.activeDays ? Math.round(curr.minutes / curr.activeDays) : 0;

  return (
    <Card title="Focus time" hint={`Completed Pomodoro sessions this ${periodName}`}
      action={onOpen && <button className="btn btn-sm" onClick={onOpen}>Open timer</button>}>
      <div className="focus-kpis">
        <div><span className="stat-label">Total</span><b>{formatMinutes(curr.minutes)}</b></div>
        <div><span className="stat-label">Sessions</span><b>{curr.count}</b></div>
        <div><span className="stat-label">Avg per active day</span><b>{curr.activeDays ? formatMinutes(avg) : '—'}</b></div>
        <div>
          <span className="stat-label">{inProgress ? `vs same point last ${periodName}` : `vs last ${periodName}`}</span>
          <b className={`delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'}`}>
            {diff > 0 ? '▲ +' : diff < 0 ? '▼ −' : '■ '}{formatMinutes(Math.abs(diff))}
          </b>
        </div>
      </div>
      {curr.count > 0 ? (
        <MinutesColumns height={200} data={curr.days.map((d) => ({
          label: labelFor ? labelFor(d.key) : formatDow(d.key),
          tipTitle: formatLong(d.key),
          minutes: d.minutes,
          sessions: d.sessions,
        }))} />
      ) : (
        <p className="muted">No focus sessions in this {periodName}.</p>
      )}
    </Card>
  );
}

export function FocusDay({ data, date, onOpen }) {
  const day = focusInRange(data, date, date);
  return (
    <Card title="Focus sessions" hint={day.count ? `${day.count} session${day.count === 1 ? '' : 's'} · ${formatMinutes(day.minutes)}` : 'Pomodoro sessions completed this day'}
      action={onOpen && <button className="btn btn-sm" onClick={onOpen}>Open timer</button>}>
      <SessionList sessions={day.sessions} habits={data.habits} />
    </Card>
  );
}

export const dayOfMonthLabel = (key) => String(parseKey(key).getDate());
