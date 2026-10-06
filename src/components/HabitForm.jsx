import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { CATEGORIES, HABIT_COLORS, EVERY_DAY, WEEKDAYS } from '../lib/habits.js';
import { DOW_LABELS, WEEK_ORDER, todayKey } from '../lib/dates.js';

export function HabitForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleDay = (d) =>
    set('schedule', form.schedule.includes(d) ? form.schedule.filter((x) => x !== d) : [...form.schedule, d].sort());

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Give the habit a name.');
    if (form.schedule.length === 0) return setError('Pick at least one day.');
    const target = Math.max(1, Math.floor(Number(form.target) || 1));
    if (form.createdAt > todayKey()) return setError('Start date can’t be in the future.');
    onSave({ ...form, name: form.name.trim(), description: form.description.trim(), unit: form.unit.trim(), target });
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="habit-form-title">
        <div className="modal-head">
          <h2 id="habit-form-title">{initial.name ? 'Edit habit' : 'New habit'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="hf-name">Name</label>
            <input id="hf-name" className="input" autoFocus value={form.name} maxLength={60}
              placeholder="e.g. Drink water" onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="hf-desc">Description <span className="muted small">(optional)</span></label>
            <input id="hf-desc" className="input" value={form.description} maxLength={120}
              placeholder="Why it matters, or how you'll do it" onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="hf-cat">Category</label>
              <select id="hf-cat" className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="hf-start">Start date</label>
              <input id="hf-start" type="date" className="input" value={form.createdAt} max={todayKey()}
                onChange={(e) => e.target.value && set('createdAt', e.target.value)} />
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="hf-target">Daily target</label>
              <input id="hf-target" type="number" min="1" max="10000" className="input" value={form.target}
                onChange={(e) => set('target', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="hf-unit">Unit <span className="muted small">(optional)</span></label>
              <input id="hf-unit" className="input" value={form.unit} maxLength={20}
                placeholder="glasses, pages, minutes…" onChange={(e) => set('unit', e.target.value)} />
            </div>
          </div>
          <p className="muted small" style={{ marginTop: -8 }}>
            Target 1 = simple check-off. Higher targets let you count progress (e.g. 8 glasses).
          </p>
          <div className="field">
            <span className="field-label">Schedule</span>
            <div className="day-picks">
              {WEEK_ORDER.map((d) => (
                <button type="button" key={d} className={`day-pick ${form.schedule.includes(d) ? 'on' : ''}`}
                  aria-pressed={form.schedule.includes(d)} onClick={() => toggleDay(d)}>
                  {DOW_LABELS[d]}
                </button>
              ))}
            </div>
            <div className="quick-sched">
              <button type="button" className="btn btn-sm" onClick={() => set('schedule', EVERY_DAY)}>Every day</button>
              <button type="button" className="btn btn-sm" onClick={() => set('schedule', WEEKDAYS)}>Weekdays</button>
              <button type="button" className="btn btn-sm" onClick={() => set('schedule', [0, 6])}>Weekends</button>
            </div>
          </div>
          <div className="field">
            <span className="field-label">Color</span>
            <div className="color-picks">
              {HABIT_COLORS.map((c) => (
                <button type="button" key={c.hex} className={`color-pick ${form.color === c.hex ? 'on' : ''}`}
                  style={{ background: c.hex }} aria-label={c.name} aria-pressed={form.color === c.hex}
                  onClick={() => set('color', c.hex)} />
              ))}
            </div>
          </div>
          {error && <div className="error-text" role="alert">{error}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary"><Icon name="check" size={16} />Save habit</button>
        </div>
      </form>
    </div>
  );
}
