import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot, ReferenceLine,
} from 'recharts';
import { parseTimeSeconds, formatSeconds } from '../utils/time.js';

const RACE_TYPE_COLOR = {
  Olympic:  '#1a5078',  // brand-700
  Sprint:   '#10b981',
  Duathlon: '#e8962a',  // finish-500
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
  if (types.length === 0) return { types: [], data: [], scoreData: [], hasScores: false };

  const allYears = results.map(r => r.year);
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  // Group athlete results by year+type — best time when multiple entries.
  const byYearType = {};
  const scoreByYearType = {};

  for (const r of results) {
    const key = `${r.year}|${r.raceType}`;
    const secs = parseTimeSeconds(r.totalTime);
    const existing = byYearType[key];
    if (!existing || (secs !== null && (existing === null || secs < existing))) {
      byYearType[key] = secs;
    }
    // Score: use triScore from backend (already computed over full field)
    const ts = r.triScore;
    if (ts && ts.score != null) {
      scoreByYearType[`${key}|ts`] = ts.score;
    }
    if (ts && ts.agScore != null) {
      scoreByYearType[`${key}|ag`] = ts.agScore;
    }
  }

  // Build field median lookup from summary.
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
  const scoreData = [];
  for (let y = minYear; y <= maxYear; y++) {
    const row = { year: y };
    const scoreRow = { year: y };
    for (const type of types) {
      const key = `${y}|${type}`;
      row[type] = key in byYearType ? byYearType[key] : null;
      row[`${type}_median`] = medianByYearType[key] ?? null;
      const ts = scoreByYearType[`${key}|ts`];
      const ag = scoreByYearType[`${key}|ag`];
      scoreRow[`${type}_ts`] = ts !== undefined ? ts : null;
      scoreRow[`${type}_ag`] = ag !== undefined ? ag : null;
    }
    data.push(row);
    scoreData.push(scoreRow);
  }

  const hasScores = scoreData.some(row =>
    types.some(t => row[`${t}_ts`] !== null || row[`${t}_ag`] !== null)
  );

  return { types, data, typePB, scoreData, hasScores };
}

function PBDot({ cx, cy, payload, dataKey, typePB, ...rest }) {
  const val = payload[dataKey];
  if (val === null || val === undefined) return null;
  const isPB = val === typePB[dataKey];
  if (isPB) {
    return <Dot cx={cx} cy={cy} r={6} fill="#e8962a" stroke="#fff" strokeWidth={2} />;
  }
  return <Dot cx={cx} cy={cy} r={3} fill={rest.stroke} stroke={rest.stroke} />;
}

function TimeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
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

function ScoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter(p => p.value !== null && p.value !== undefined);
  if (!entries.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[160px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {entries.map(p => {
        const isAG = p.dataKey.endsWith('_ag');
        const type = p.dataKey.replace(/_ts$|_ag$/, '');
        return (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color, opacity: isAG ? 0.5 : 1 }} />
            <span className="text-slate-600">{type} {isAG ? 'age group' : 'TriScore'}</span>
            <span className="font-mono font-medium text-slate-900 ml-auto pl-2">{Math.round(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TimelineChart({ results, summary }) {
  const { types, data, typePB, scoreData, hasScores } = useMemo(
    () => buildSeries(results, summary),
    [results, summary]
  );

  if (types.length === 0) return null;

  const hasMedian = data.some(row => types.some(t => row[`${t}_median`] !== null));

  return (
    <div className="space-y-3">
      {/* Panel 1: Finish time history */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="font-display text-base font-semibold text-brand-900 tracking-tight mb-3 uppercase">Finish Time History</h3>
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

      {/* Panel 2: Performance score trend — only when score data exists */}
      {hasScores && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="font-display text-base font-semibold text-brand-900 tracking-tight mb-3 uppercase">Performance Score</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={scoreData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<ScoreTooltip />} />
              <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="2 2" />
              {/* Age group percentile — lighter, dashed */}
              {types.map(type => (
                <Line
                  key={`${type}_ag`}
                  type="monotone"
                  dataKey={`${type}_ag`}
                  stroke={colorFor(type)}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 3 }}
                  legendType="none"
                />
              ))}
              {/* TriScore — solid, same color family */}
              {types.map(type => (
                <Line
                  key={`${type}_ts`}
                  type="monotone"
                  dataKey={`${type}_ts`}
                  stroke={colorFor(type)}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: colorFor(type), stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5 }}
                  legendType="none"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[10px] text-slate-400 text-right">Solid = TriScore · Dashed = age group percentile · 50 = field median</p>
        </div>
      )}
    </div>
  );
}
