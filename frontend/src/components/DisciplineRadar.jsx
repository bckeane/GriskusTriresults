import { useRef } from 'react';
import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { api } from '../utils/api.js';
import { parseTimeSeconds } from '../utils/time.js';
import { RACE_TYPE_HEX } from '../constants/raceTypes.js';

function splitPercentile(athleteTimeStr, fieldResults, discipline) {
  const athleteSecs = parseTimeSeconds(athleteTimeStr);
  if (!athleteSecs) return null;
  const fieldTimes = fieldResults.map(r => parseTimeSeconds(r[discipline])).filter(Boolean);
  if (fieldTimes.length === 0) return null;
  const slower = fieldTimes.filter(t => t > athleteSecs).length;
  return Math.round((slower / fieldTimes.length) * 100);
}

async function fetchFieldData(combos, fieldCache) {
  const missing = combos.filter(k => !fieldCache.has(k));
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    await Promise.all(
      batch.map(async (k) => {
        const [year, raceType] = k.split('|');
        try {
          const res = await fetch(api(`/api/results?year=${year}&raceType=${encodeURIComponent(raceType)}&limit=9999`));
          const data = await res.json();
          fieldCache.set(k, data.results ?? []);
        } catch {
          fieldCache.set(k, null); // null = fetch failed; [] = fetched but no results
        }
      })
    );
  }
}

function computeRadarData(typeResults, fieldData) {
  const pcts = { swim: [], bike: [], run: [] };
  for (const r of typeResults) {
    const field = fieldData.get(`${r.year}|${r.raceType}`);
    if (field === null) continue;
    const s = splitPercentile(r.swimTime, field, 'swimTime');
    const b = splitPercentile(r.bikeTime, field, 'bikeTime');
    const rn = splitPercentile(r.runTime, field, 'runTime');
    if (s != null) pcts.swim.push(s);
    if (b != null) pcts.bike.push(b);
    if (rn != null) pcts.run.push(rn);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const swimAvg = avg(pcts.swim);
  const bikeAvg = avg(pcts.bike);
  const runAvg  = avg(pcts.run);
  if (swimAvg == null && bikeAvg == null && runAvg == null) return null;
  return [
    { subject: 'Swim', value: swimAvg ?? 0, fullMark: 100 },
    { subject: 'Bike', value: bikeAvg ?? 0, fullMark: 100 },
    { subject: 'Run',  value: runAvg  ?? 0, fullMark: 100 },
  ];
}

function MiniRadar({ label, color, radarData, raceCount }) {
  if (!radarData) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-xs text-slate-300 text-center px-2">No data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color }}>
        {label}
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={radarData} margin={{ top: 6, right: 20, bottom: 6, left: 20 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            tickCount={3}
            axisLine={false}
          />
          <Radar
            name={label}
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(val) => [`${val}th percentile`, '']}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 mt-0.5">{raceCount} race{raceCount !== 1 ? 's' : ''}</p>
      <table className="sr-only" aria-label={`${label} discipline percentiles`}>
        <thead><tr><th scope="col">Discipline</th><th scope="col">Percentile vs field</th></tr></thead>
        <tbody>
          {radarData.map(d => (
            <tr key={d.subject}><td>{d.subject}</td><td>{d.value}th percentile</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DisciplineRadar({ results }) {
  const fieldCache = useRef(new Map());
  const [fieldData, setFieldData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const splitResults = results.filter(
    r => r.swimTime && r.bikeTime && r.runTime && r.raceType !== 'Duathlon'
  );

  const sprintResults  = splitResults.filter(r => r.raceType === 'Sprint');
  const olympicResults = splitResults.filter(r => r.raceType === 'Olympic');

  const distinctYears = (rs) => new Set(rs.map(r => r.year)).size;
  const hasEnough = distinctYears(sprintResults) >= 3 || distinctYears(olympicResults) >= 3;

  if (!fetched && !loading && hasEnough) {
    setFetched(true);
    setLoading(true);
    const combos = [...new Set(splitResults.map(r => `${r.year}|${r.raceType}`))];
    fetchFieldData(combos, fieldCache.current).then(() => {
      setFieldData(new Map(fieldCache.current));
      setLoading(false);
    });
  }

  if (!hasEnough) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
        <p className="text-sm text-slate-400">Not enough split data to show your Discipline DNA yet.</p>
        <p className="text-xs text-slate-300 mt-1">Requires 3+ years of races with swim, bike, and run splits recorded.</p>
      </div>
    );
  }

  const sprintData  = fieldData ? computeRadarData(sprintResults, fieldData) : null;
  const olympicData = fieldData ? computeRadarData(olympicResults, fieldData) : null;
  const totalData   = fieldData ? computeRadarData(splitResults, fieldData) : null;

  const TOTAL_COLOR = '#6366f1'; // indigo — neutral, not tied to a race type

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <h3 className="font-display text-base font-semibold text-brand-900 tracking-tight uppercase mb-3">
        Discipline DNA
      </h3>

      {loading || !fieldData ? (
        <div className="h-[180px] flex items-center justify-center">
          <svg className="h-6 w-6 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <MiniRadar
            label="Sprint"
            color={RACE_TYPE_HEX.Sprint}
            radarData={sprintData}
            raceCount={sprintResults.length}
          />
          <MiniRadar
            label="Olympic"
            color={RACE_TYPE_HEX.Olympic}
            radarData={olympicData}
            raceCount={olympicResults.length}
          />
          <MiniRadar
            label="Total"
            color={TOTAL_COLOR}
            radarData={totalData}
            raceCount={splitResults.length}
          />
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400 text-right">
        Percentile vs. field — higher = faster relative to field
      </p>
    </div>
  );
}
