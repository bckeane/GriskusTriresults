import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { parseTimeSeconds, formatSeconds } from '../utils/time.js';
import { RACE_TYPE_HEX } from '../constants/raceTypes.js';

const DISCIPLINES = [
  { key: 'swimTime', label: 'Swim' },
  { key: 'bikeTime', label: 'Bike' },
  { key: 'runTime',  label: 'Run' },
];

function buildArcData(results, summary, raceType) {
  const typeResults = results.filter(
    r => r.raceType === raceType && r.swimTime && r.bikeTime && r.runTime
  );
  if (typeResults.length === 0) return null;

  const years = [...new Set(typeResults.map(r => r.year))].sort((a, b) => a - b);
  if (years.length < 3) return null;

  const minYear = years[0];
  const maxYear = years[years.length - 1];

  // Best split per year (in case of duplicate entries).
  const bestByYear = {};
  for (const r of typeResults) {
    if (!bestByYear[r.year] || parseTimeSeconds(r.totalTime) < parseTimeSeconds(bestByYear[r.year].totalTime)) {
      bestByYear[r.year] = r;
    }
  }

  const data = [];
  for (let y = minYear; y <= maxYear; y++) {
    const r = bestByYear[y];
    if (!r) {
      data.push({ year: y, swimSecs: null, bikeSecs: null, runSecs: null, fieldPct: null });
      continue;
    }
    const fieldCount = summary?.find(s => s.year === r.year && s.raceType === r.raceType)?.count ?? null;
    const fieldPct = (r.place != null && fieldCount != null && fieldCount > 0)
      ? Math.round((r.place / fieldCount) * 100)
      : null;
    data.push({
      year: y,
      swimSecs: parseTimeSeconds(r.swimTime),
      bikeSecs: parseTimeSeconds(r.bikeTime),
      runSecs:  parseTimeSeconds(r.runTime),
      fieldPct,
    });
  }
  return data;
}

function DisciplineChart({ data, disciplineKey, label, color }) {
  const secKey = `${disciplineKey.replace('Time', '')}Secs`;

  // bike splits can exceed 3600s (H:MM:SS) — use wider axis
  const isBike = disciplineKey === 'bikeTime';

  const tableRows = data.filter(d => d[secKey] != null);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="time"
            orientation="left"
            reversed
            tickFormatter={formatSeconds}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={isBike ? 58 : 44}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            content={({ active, payload, label: yr }) => {
              if (!active || !payload?.length) return null;
              const timeEntry = payload.find(p => p.yAxisId === 'time');
              const pctEntry  = payload.find(p => p.yAxisId === 'pct');
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
                  <div className="font-semibold text-slate-700 mb-1">{yr}</div>
                  {timeEntry?.value != null && (
                    <div className="text-slate-600">{label}: <span className="font-mono font-medium">{formatSeconds(timeEntry.value)}</span></div>
                  )}
                  {pctEntry?.value != null && (
                    <div className="text-slate-400">Field position: top {pctEntry.value}%</div>
                  )}
                </div>
              );
            }}
          />
          <Line
            yAxisId="time"
            type="monotone"
            dataKey={secKey}
            stroke={color}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="fieldPct"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {tableRows.length > 0 && (
        <table className="sr-only" aria-label={`${label} split history`}>
          <thead>
            <tr><th scope="col">Year</th><th scope="col">Time</th>{tableRows.some(d => d.fieldPct != null) && <th scope="col">Field position</th>}</tr>
          </thead>
          <tbody>
            {tableRows.map(d => (
              <tr key={d.year}>
                <td>{d.year}</td>
                <td>{formatSeconds(d[secKey])}</td>
                {d.fieldPct != null && <td>Top {d.fieldPct}%</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CareerArc({ results, summary }) {
  if (!summary) return null;

  const splitResults = results.filter(r => r.swimTime && r.bikeTime && r.runTime);
  const raceTypes = [...new Set(splitResults.map(r => r.raceType))].sort();

  const arcsByType = useMemo(() => {
    const out = {};
    for (const t of raceTypes) {
      out[t] = buildArcData(splitResults, summary, t);
    }
    return out;
  }, [results, summary]);

  const eligibleTypes = raceTypes.filter(t => arcsByType[t] !== null);
  const [mobileTab, setMobileTab] = useState(0);

  if (eligibleTypes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
        <p className="text-sm text-slate-400">Career Arc unlocks after 3+ years of races with split data recorded.</p>
        <p className="text-xs text-slate-300 mt-1">Split data (swim, bike, run) is available for most races from 2017 onward.</p>
      </div>
    );
  }

  // On mobile (< sm), show one race type at a time via tabs.
  // On sm+, show all race types stacked (original layout).
  const activeTab = Math.min(mobileTab, eligibleTypes.length - 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-semibold text-brand-900 tracking-tight uppercase">
          Career Arc
        </h3>
        {eligibleTypes.length > 1 && (
          <div className="flex gap-1 sm:hidden">
            {eligibleTypes.map((t, i) => (
              <button
                key={t}
                onClick={() => setMobileTab(i)}
                aria-pressed={activeTab === i}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === i
                    ? 'bg-brand-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: single active race type */}
      <div className="sm:hidden space-y-4">
        {(() => {
          const raceType = eligibleTypes[activeTab];
          const data = arcsByType[raceType];
          const color = RACE_TYPE_HEX[raceType] ?? '#0ea5e9';
          return (
            <>
              <div className="grid grid-cols-1 gap-4">
                {DISCIPLINES.map(({ key, label }) => (
                  <DisciplineChart key={key} data={data} disciplineKey={key} label={label} color={color} />
                ))}
              </div>
              <p className="text-[10px] text-slate-400 text-right">
                Solid = split time (left axis) · Dashed = field position % (right axis)
              </p>
            </>
          );
        })()}
      </div>

      {/* Desktop: all race types stacked */}
      <div className="hidden sm:block space-y-6">
        {eligibleTypes.map(raceType => {
          const data = arcsByType[raceType];
          const color = RACE_TYPE_HEX[raceType] ?? '#0ea5e9';
          return (
            <div key={raceType}>
              <p className="font-display text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{raceType}</p>
              <div className="grid grid-cols-3 gap-4">
                {DISCIPLINES.map(({ key, label }) => (
                  <DisciplineChart key={key} data={data} disciplineKey={key} label={label} color={color} />
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-slate-400 text-right">
          Solid = split time (left axis) · Dashed = field position % (right axis)
        </p>
      </div>
    </div>
  );
}
