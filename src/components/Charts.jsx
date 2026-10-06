import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Cell, ReferenceLine,
} from 'recharts';
import { pct } from '../lib/analytics.js';

// Chart tokens (validated pink/blue pair on a white surface).
export const C = {
  current: '#d63f78',
  currentMuted: '#f0a1c0',
  previous: '#3a6fc0',
  grid: '#eceef3',
  axis: '#d5d9e3',
  tick: '#7d879b',
};

const axisProps = {
  tick: { fill: C.tick, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: C.axis },
};
const pctAxis = {
  ...axisProps,
  axisLine: false,
  domain: [0, 1],
  ticks: [0, 0.25, 0.5, 0.75, 1],
  tickFormatter: (v) => `${Math.round(v * 100)}%`,
  width: 44,
};

function Tip({ active, payload, label, rows }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <div className="t">{p.tipTitle ?? label}</div>
      {rows(p, payload).map((r, i) => (
        <div className="r" key={i}>
          <span className="key">
            {r.color && <span className="swatch" style={{ background: r.color }} />}
            {r.label}
          </span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/**
 * Daily completion-rate trend. data: [{ label, rate, completed, scheduled, tipTitle, highlight }]
 * Single series → no legend; the card title names it.
 */
export function TrendChart({ data, height = 260, average }) {
  const plotted = data.map((d) => ({ ...d, rate: d.rate ?? null }));
  return (
    <div className="chart-box" style={{ '--h': `${height}px` }}>
      <ResponsiveContainer>
        <AreaChart data={plotted} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pinkWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.current} stopOpacity={0.16} />
              <stop offset="100%" stopColor={C.current} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...pctAxis} />
          {average != null && (
            <ReferenceLine y={average} stroke={C.previous} strokeWidth={1} />
          )}
          <Tooltip
            cursor={{ stroke: C.axis, strokeWidth: 1 }}
            content={<Tip rows={(p) => [
              { label: 'Completion', value: pct(p.rate), color: C.current },
              { label: 'Habits done', value: `${p.completed}/${p.scheduled}` },
            ]} />}
          />
          <Area type="monotone" dataKey="rate" stroke={C.current} strokeWidth={2} fill="url(#pinkWash)"
            connectNulls={false} isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props;
              if (!payload.highlight || cy == null) return <g key={index} />;
              return <circle key={index} cx={cx} cy={cy} r={5} fill={C.current} stroke="#fff" strokeWidth={2} />;
            }}
            activeDot={{ r: 5, fill: C.current, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-series columns: this period vs previous period. data: [{ label, current, previous, ... }] */
export function CompareColumns({ data, currentName, previousName, height = 260 }) {
  return (
    <>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span className="key"><span className="sw" style={{ background: C.current }} />{currentName}</span>
        <span className="key"><span className="sw" style={{ background: C.previous }} />{previousName}</span>
      </div>
      <div className="chart-box" style={{ '--h': `${height}px` }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...pctAxis} />
            <Tooltip
              cursor={{ fill: 'rgba(214,63,120,0.06)' }}
              content={<Tip rows={(p) => [
                { label: currentName, value: p.current == null ? '—' : `${pct(p.current)} (${p.currentDone}/${p.currentSched})`, color: C.current },
                { label: previousName, value: p.previous == null ? '—' : `${pct(p.previous)} (${p.previousDone}/${p.previousSched})`, color: C.previous },
              ]} />}
            />
            <Bar dataKey="current" fill={C.current} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="previous" fill={C.previous} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** Focus minutes per day (single series). data: [{ label, tipTitle, minutes, sessions }] */
export function MinutesColumns({ data, height = 220 }) {
  const max = Math.max(0, ...data.map((d) => d.minutes));
  const step = max <= 60 ? 15 : max <= 120 ? 30 : max <= 240 ? 60 : 120;
  const top = Math.max(step * 2, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return (
    <div className="chart-box" style={{ '--h': `${height}px` }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...axisProps} axisLine={false} width={44} domain={[0, top]} ticks={ticks}
            tickFormatter={(v) => (v < 60 ? `${v}m` : v % 60 ? `${Math.floor(v / 60)}h${v % 60}` : `${v / 60}h`)} />
          <Tooltip
            cursor={{ fill: 'rgba(214,63,120,0.06)' }}
            content={<Tip rows={(p) => [
              { label: 'Focus time', value: `${p.minutes} min`, color: C.current },
              { label: 'Sessions', value: p.sessions },
            ]} />}
          />
          <Bar dataKey="minutes" fill={C.current} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series columns of a rate (e.g. weekday performance, week-of-month). Best bar emphasized. */
export function RateColumns({ data, height = 230, emphasizeBest = true }) {
  const best = emphasizeBest ? Math.max(...data.map((d) => d.rate ?? -1)) : null;
  return (
    <div className="chart-box" style={{ '--h': `${height}px` }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...pctAxis} />
          <Tooltip
            cursor={{ fill: 'rgba(214,63,120,0.06)' }}
            content={<Tip rows={(p) => [
              { label: 'Completion', value: pct(p.rate), color: C.current },
              { label: 'Habits done', value: `${p.completed}/${p.scheduled}` },
            ]} />}
          />
          <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}
            label={{ position: 'top', fill: C.tick, fontSize: 11, formatter: (v) => (v == null ? '' : pct(v)) }}>
            {data.map((d, i) => (
              <Cell key={i} fill={best != null && d.rate === best && best >= 0 ? C.current : C.currentMuted} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
