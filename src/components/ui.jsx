import { pct } from '../lib/analytics.js';

const PATHS = {
  today: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4',
  habits: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  daily: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  weekly: 'M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V5',
  monthly: 'M3 4h18v18H3zM3 10h18M8 2v4M16 2v4M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  close: 'M18 6L6 18M6 6l12 12',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-5-3-7 0 4-4 7-4 13 0 4 3 7 7 7z',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  spark: 'M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  chart: 'M3 3v18h18M7 14l4-4 3 3 5-6',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  play: 'M7 4.5l12 7.5-12 7.5z',
  pause: 'M8 5v14M16 5v14',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  volume: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-3.2 4.1M6.6 6.6C3.4 8.6 1 12 1 12s4 7 11 7a10.8 10.8 0 0 0 5.4-1.4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

export function Icon({ name, size = 18, stroke = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}

export function Card({ title, hint, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <div className="hint">{hint}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Signed percentage-point change; up is good for completion rates. */
export function Delta({ value, suffix = 'vs prev.', unit = 'pts' }) {
  if (value == null) return <span className="muted">No comparison</span>;
  const pts = unit === 'pts' ? Math.round(value * 100) : value;
  const dir = pts > 0 ? 'up' : pts < 0 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■';
  return (
    <>
      <span className={`delta ${dir}`} aria-label={`${dir} ${Math.abs(pts)} ${unit}`}>
        {arrow} {pts > 0 ? '+' : ''}{pts}{unit === 'pts' ? ' pts' : ''}
      </span>
      <span>{suffix}</span>
    </>
  );
}

export function StatTile({ label, value, foot, accent }) {
  return (
    <div className={`card stat ${accent ? 'stat-accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

export function PeriodNav({ label, onPrev, onNext, nextDisabled, onToday, todayLabel = 'Today' }) {
  return (
    <div className="period-nav">
      <button className="icon-btn" onClick={onPrev} aria-label="Previous period"><Icon name="left" /></button>
      <div className="label">{label}</div>
      <button className="icon-btn" onClick={onNext} disabled={nextDisabled} aria-label="Next period"><Icon name="right" /></button>
      {onToday && <button className="btn btn-sm" onClick={onToday}>{todayLabel}</button>}
    </div>
  );
}

export function RateBar({ value }) {
  return (
    <div className="rate-bar">
      <div className="track"><div className="fill" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} /></div>
      <span className="v">{pct(value)}</span>
    </div>
  );
}

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Insights({ items }) {
  return (
    <ul className="insights">
      {items.map((t, i) => (
        <li key={i}>
          <span className="ico"><Icon name="spark" size={13} /></span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProgressRing({ value, size = 128, stroke = 12, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(v * 100)}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pink-100)" strokeWidth={stroke} />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pink-500)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }} />}
      </svg>
      <div className="ring-label"><b>{label}</b><span>{sub}</span></div>
    </div>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Habit × day status cell used in matrix tables. */
export function StatusCell({ state, title }) {
  return (
    <span className={`cell-dot ${state}`} title={title} aria-label={title}>
      {state === 'done' && <Icon name="check" size={14} stroke={3} />}
      {state === 'partial' && <span style={{ fontSize: 10, fontWeight: 700 }}>½</span>}
      {state === 'off' && '·'}
    </span>
  );
}
