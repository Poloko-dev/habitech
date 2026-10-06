import { useMemo, useState } from 'react';
import { Card, PageHead, Icon, Badge, RateBar } from '../components/ui.jsx';
import { rangeStats, streaks } from '../lib/analytics.js';
import { scheduleLabel, stripHabitNotes } from '../lib/habits.js';
import { HabitDetail } from '../components/HabitDetail.jsx';
import { ActionMenu } from '../components/ActionMenu.jsx';
import { todayKey, addDays, formatShort } from '../lib/dates.js';

export function Habits({ data, update, onAddHabit, onEditHabit }) {
  const today = todayKey();
  const [openId, setOpenId] = useState(null);
  const stats = useMemo(() => {
    const r = rangeStats(data, addDays(today, -29), today);
    return Object.fromEntries(r.perHabit.map((p) => [p.habit.id, p]));
  }, [data, today]);

  const active = data.habits.filter((h) => !h.archivedAt);
  const archived = data.habits.filter((h) => h.archivedAt);

  const archive = (h) =>
    update((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, archivedAt: today } : x)) }));
  const restore = (h) =>
    update((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, archivedAt: null } : x)) }));
  const remove = (h) => {
    if (!window.confirm(`Delete “${h.name}” and all of its history? This can’t be undone. (Archive keeps the history.)`)) return;
    update((d) => {
      const logs = {};
      for (const [k, day] of Object.entries(d.logs)) {
        const { [h.id]: _, ...rest } = day;
        if (Object.keys(rest).length) logs[k] = rest;
      }
      const habitNotes = stripHabitNotes(d.habitNotes, new Set([h.id]));
      return { ...d, habits: d.habits.filter((x) => x.id !== h.id), logs, habitNotes };
    });
  };

  const rows = (list, isArchived) => (
    <div className="table-wrap">
      <table className="table stacked">
        <thead>
          <tr>
            <th>Habit</th>
            <th>Schedule</th>
            <th className="num">Target</th>
            <th>Since</th>
            <th className="num">Streak</th>
            <th style={{ minWidth: 160 }}>Last 30 days</th>
            <th className="num" style={{ width: 56 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => {
            const s = streaks(data, h, today);
            return (
              <tr key={h.id} className="clickable-row" onClick={() => setOpenId(h.id)}>
                <td className="cell-title">
                  <div className="habit-name">
                    <span className="swatch" style={{ background: h.color }} />
                    <button className="link-btn" onClick={(e) => { e.stopPropagation(); setOpenId(h.id); }}
                      aria-label={`Open details for ${h.name}`}>{h.name}</button>
                  </div>
                  <div className="habit-meta"><Badge tone="navy">{h.category}</Badge></div>
                </td>
                <td data-label="Schedule">{scheduleLabel(h.schedule)}</td>
                <td className="num" data-label="Target">{h.target}{h.unit ? ` ${h.unit}` : ''}</td>
                <td data-label="Since">{formatShort(h.createdAt)}{isArchived && <div className="muted small">archived {formatShort(h.archivedAt)}</div>}</td>
                <td className="num" data-label="Streak (best)"><span className="flame"><Icon name="flame" size={13} />{s.current}</span> <span className="muted small">/ {s.longest}</span></td>
                <td className="cell-wide" data-label="Last 30 days">{stats[h.id] ? <RateBar value={stats[h.id].rate} /> : <span className="muted">—</span>}</td>
                <td className="num cell-actions" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu label={`Actions for ${h.name}`} items={[
                    ...(isArchived
                      ? [{ label: 'Restore', icon: 'restore', onSelect: () => restore(h) }]
                      : [
                          { label: 'Edit', icon: 'edit', onSelect: () => onEditHabit(h) },
                          { label: 'Archive', icon: 'archive', onSelect: () => archive(h) },
                        ]),
                    { label: 'Delete', icon: 'trash', danger: true, onSelect: () => remove(h) },
                  ]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Manage" title="Habits" sub={`${active.length} active · ${archived.length} archived`}>
        <button className="btn btn-primary" onClick={onAddHabit}><Icon name="plus" size={16} />New habit</button>
      </PageHead>
      <div className="stack">
        <Card title="Active habits" hint="Click a habit to see details, log progress and write what you did">
          {active.length ? rows(active, false) : <p className="muted">No active habits yet.</p>}
        </Card>
        {archived.length > 0 && (
          <Card title="Archived" hint="Archived habits stop counting from the archive date; their history stays in past reports.">
            {rows(archived, true)}
          </Card>
        )}
      </div>
      {openId && (
        <HabitDetail data={data} update={update} habitId={openId} onClose={() => setOpenId(null)} onEdit={onEditHabit} />
      )}
    </>
  );
}

