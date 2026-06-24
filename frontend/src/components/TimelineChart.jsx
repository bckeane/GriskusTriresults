import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot,
} from 'recharts';
import { parseTimeSeconds, formatSeconds } from '../utils/time.js';

const RACE_TYPE_COLOR = {
  Olympic:  '#3b82f6',
  Sprint:   '#10b981',
  Duathlon: '#f59e0b',
};

function fallbackColor(raceType) {
  let h = 0;
  for (let i = 0; i < raceType.length; i++) h = (h * 31 + raceType.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360}, 60%, 50%)`;
}

function colorFor(raceType) {
  return RACE_TYPE_COLOR[raceType] ?? fallbackColor(raceType);
}

function buildSeries(results, summary) {
  const types = [...new Set(results.map(r => r.raceType))].sort();
  if (types.length === 0) return { types: [], data: [] };

  const allYears = results.map(r => r.year);
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  // Group athlete results by year+type.
  const byYearType = {};
  for (const r of results) {
    const key = `${r.year}|${r.raceType}`;
    const existing = byYearType[key];
    const secs = parseTimeSeconds(r.totalTime);
    if (!existing || (secs !== null && (existing === null || secs < existing))) {
      byYearType[key] = secs;
    }
  }

  // Build field median lookup from summary (only for years/types present in athlete data).
  const medianByYearType = {};
  if (summary) {
    for (const s of summary) {
      const key = `${s.year}|${s.raceType}`;
      if (key in byYearType) {
        medianByYearType[key] = parseTimeSeconds(s.median);
      }
    }
  }

  // Per-type personal best for gold dot.
  const typePB = {};
  for (const type of types) {
    let best = null;
    for (let y = minYear; y <= maxYear; y++) {
      const s = byYearType[`${y}|${type}`];
      if (s !== undefined && s !== null && (best === null || s < best)) best = s;
    }
    typePB[type] = best;
  }

  const data = [];
  for (let y = minYear; y <= maxYear; y++) {
    const row = { year: y };
    for (const type of types) {
      const key = `${y}|${type}`;
      row[type] = key in byYearType ? byYearType[key] : null;
      row[`${type}_median`] = medianByYearType[key] ?? null;
    }
    data.push(row);
  }

  return { types, data, typePB };
}

function PBDot({ cx, cy, payload, dataKey, typePB, ...rest }) {
  const val = payload[dataKey];
  if (val === null || val === undefined) return null;
  const isPB = val === typePB[dataKey];
  if (isPB) {
    return <Dot cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
  }
  return <Dot cx={cx} cy={cy} r={3} fill={rest.stroke} stroke={rest.stroke} />;
}

function TimeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Split into athlete entries and median entries, skip nulls.
  const athlete = payload.filter(p => !p.dataKey.endsWith('_median') && p.value !== null);
  const medians = payload.filter(p => p.dataKey.endsWith('_median') && p.value !== null);
  if (!athlete.length && !medians.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[140px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {athlete.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.dataKey}</span>
          <span className="font-mono font-medium text-slate-900 ml-auto pl-2">{formatSeconds(p.value)}</span>
        </div>
      ))}
      {medians.length > 0 && athlete.length > 0 && (
        <div className="border-t border-slate-100 mt-1 pt-1" />
      )}
      {medians.map(p => {
        const type = p.dataKey.replace('_median', '');
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-slate-400">
            <span className="inline-block w-2.5 h-0.5" style={{ background: p.color }} />
            <span>{type} field median</span>
            <span className="font-mono ml-auto pl-2">{formatSeconds(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TimelineChart({ results, summary }) {
  const { types, data, typePB } = useMemo(() => buildSeries(results, summary), [results, summary]);

  if (types.length === 0) return null;

  const hasMedian = data.some(row => types.some(t => row[`${t}_median`] !== null));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-600 mb-3">Finish Time History</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatSeconds}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={56}
            reversed
          />
          <Tooltip content={<TimeTooltip />} />
          {types.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => value.endsWith('_median') ? null : value}
            />
          )}
          {/* Field median: dashed, same color, no dots, legend-hidden */}
          {hasMedian && types.map(type => (
            <Line
              key={`${type}_median`}
              type="monotone"
              dataKey={`${type}_median`}
              stroke={colorFor(type)}
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.45}
              connectNulls={false}
              dot={false}
              activeDot={false}
              legendType="none"
            />
          ))}
          {/* Athlete lines on top */}
          {types.map(type => (
            <Line
              key={type}
              type="monotone"
              dataKey={type}
              stroke={colorFor(type)}
              strokeWidth={2}
              connectNulls={false}
              dot={(props) => <PBDot {...props} dataKey={type} typePB={typePB} />}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {hasMedian && (
        <p className="mt-2 text-[10px] text-slate-400 text-right">Dashed line = field median finish time</p>
      )}
    </div>
  );
}
