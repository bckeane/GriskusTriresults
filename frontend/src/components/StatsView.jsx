import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { parseTimeSeconds, formatSeconds } from '../utils/time.js';

const RACE_COLOR = { Olympic: '#3b82f6', Sprint: '#10b981', Duathlon: '#f59e0b' };
const colorFor = rt => RACE_COLOR[rt] ?? '#94a3b8';

// Known course anomalies: year|raceType|discipline → note
const ANOMALIES = {
  '1999|Sprint|swim':    { label: 'Short?', note: 'Median 12:58 — ~5 min faster than any other year. Possible short swim course.' },
  '2004|Olympic|swim':   { label: 'Short?', note: 'Median 18:42 — half the usual 35-37 min. Likely short or current-assisted.' },
  '2006|Olympic|swim':   { label: 'Bad data', note: 'Split data corrupted — swim value equals bike value. Timing system error.' },
  '2006|Olympic|bike':   { label: 'Bad data', note: 'Split data corrupted — bike value equals swim value. Timing system error.' },
  '2024|Olympic|swim':   { label: 'Short?', note: 'Median 21:52 — about 14 min faster than surrounding years. Possibly short swim.' },
  '2024|Duathlon|run':   { label: 'Bad data', note: 'Median ~17 min vs 47-50 min in other years — likely a timing/data error.' },
  '2025|Duathlon|run':   { label: 'Bad data', note: 'Median ~17 min vs 47-50 min in other years — likely a timing/data error.' },
};

// Sprint bike course lengthened between 2008 and 2017 (~35 min → ~46 min)
const COURSE_CHANGE_YEARS = {
  '2017|Sprint|bike': { label: 'Longer course', note: 'Bike time jumped ~10 min from pre-2009 era (35 min → 46 min). Course likely extended from ~10 to ~11.5 miles around this time.' },
};

const ALL_FLAGS = { ...ANOMALIES, ...COURSE_CHANGE_YEARS };

function flagFor(year, raceType, discipline) {
  return ALL_FLAGS[`${year}|${raceType}|${discipline}`] ?? null;
}

// ── Shared chart helpers ──────────────────────────────────────────────────────

function Section({ title, note, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
        {note && <span className="text-xs text-slate-400 italic">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-brand-600 font-medium mt-0.5">{sub}</div>}
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function FinisherTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[130px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-600">{p.dataKey}</span>
          <span className="font-medium text-slate-900 ml-auto pl-2">{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between text-slate-500">
          <span>Total</span><span className="font-semibold">{total}</span>
        </div>
      )}
    </div>
  );
}

function TimeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value !== null && p.value !== undefined);
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[150px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {items.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-0.5" style={{ background: p.stroke, borderTop: p.strokeDasharray ? `2px dashed ${p.stroke}` : undefined }} />
          <span className="text-slate-600">{p.name}</span>
          <span className="font-mono font-medium text-slate-900 ml-auto pl-2">{formatSeconds(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Discipline chart ──────────────────────────────────────────────────────────

function DisciplineChart({ title, discipline, raceType, data, color }) {
  // data: [{ year, min, avg, median, max, hasData, flagKey }]
  const hasAny = data.some(d => d.hasData);
  if (!hasAny) return null;

  const flags = data.filter(d => d.flag);

  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatSeconds} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} reversed />
          <Tooltip content={<TimeTooltip />} />
          <Line type="monotone" dataKey="min"    name="Best"    stroke={color} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="median" name="Median"  stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls={false} />
          <Line type="monotone" dataKey="max"    name="Slowest" stroke={color} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="avg"    name="Avg"     stroke={color} strokeWidth={1} strokeOpacity={0.4} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1.5 space-y-0.5">
        <p className="text-[10px] text-slate-400 text-right">Solid = median · dashed = best/slowest · faint = avg{flags.length > 0 && <> · <span className="text-amber-500">⬤ see notes below</span></>}</p>
        {flags.map(d => (
          <p key={d.year} className="text-[10px] text-slate-400 leading-snug">
            <span className="text-amber-500 mr-1">†{d.year}</span>{d.flag.note}
          </p>
        ))}
      </div>
    </div>
  );
}

const AGE_BRACKETS = ['U20', '20s', '30s', '40s', '50s', '60s', '70s'];
const AGE_COLORS   = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#e879f9', '#94a3b8'];

function GenderTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[130px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map(p => p.value > 0 && (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-600">{p.name}</span>
          <span className="font-medium text-slate-900 ml-auto pl-2">{p.value}</span>
          <span className="text-slate-400">({total > 0 ? Math.round(p.value / total * 100) : 0}%)</span>
        </div>
      ))}
    </div>
  );
}

function AgeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter(p => p.value > 0).reverse();
  const total = entries.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[140px]">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {entries.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-600">{p.name}</span>
          <span className="font-medium text-slate-900 ml-auto pl-2">{p.value}</span>
          <span className="text-slate-400">({total > 0 ? Math.round(p.value / total * 100) : 0}%)</span>
        </div>
      ))}
    </div>
  );
}

function DemographicsSection({ demographics, yearSet, raceTypes }) {
  const [activeTab, setActiveTab] = useState(raceTypes[0]);
  const rt = activeTab ?? raceTypes[0];

  // Gender split: one row per year for the active race type
  const genderData = yearSet.map(year => {
    const entry = demographics.find(d => d.year === year && d.raceType === rt);
    return {
      year,
      Male:   entry?.male   ?? null,
      Female: entry?.female ?? null,
    };
  });

  // Age group: one row per year, columns per bracket
  const ageData = yearSet.map(year => {
    const entry = demographics.find(d => d.year === year && d.raceType === rt);
    const row = { year };
    for (const b of AGE_BRACKETS) row[b] = entry?.ageGroups?.[b] ?? null;
    return row;
  });

  const hasAge = ageData.some(r => AGE_BRACKETS.some(b => r[b] != null));

  return (
    <Section title="Participation">
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {raceTypes.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              (activeTab ?? raceTypes[0]) === t
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 ${hasAge ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Gender Split</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={genderData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<GenderTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              <Bar dataKey="Male"   stackId="g" fill="#3b82f6" />
              <Bar dataKey="Female" stackId="g" fill="#f472b6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {hasAge && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Age Groups</h4>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={ageData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<AgeTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                {AGE_BRACKETS.map((b, i) => (
                  <Area
                    key={b}
                    type="monotone"
                    dataKey={b}
                    stackId="a"
                    stroke={AGE_COLORS[i]}
                    fill={AGE_COLORS[i]}
                    fillOpacity={0.7}
                    strokeWidth={0}
                    connectNulls={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Section>
  );
}

// ── RaceTypeStats ─────────────────────────────────────────────────────────────

function RaceTypeStats({ raceType, summaryEntries, yearSet }) {
  const color = colorFor(raceType);

  function buildDisciplineData(field) {
    return yearSet.map(year => {
      const entry = summaryEntries.find(s => s.year === year);
      if (!entry) return { year, hasData: false, min: null, avg: null, median: null, max: null, flag: null };
      const d = entry.disciplines[field];
      const hasData = d.median !== null;
      return {
        year,
        hasData,
        min:    parseTimeSeconds(d.min),
        avg:    parseTimeSeconds(d.avg),
        median: parseTimeSeconds(d.median),
        max:    parseTimeSeconds(d.max),
        flag:   flagFor(year, raceType, field),
      };
    });
  }

  const swimData  = buildDisciplineData('swim');
  const bikeData  = buildDisciplineData('bike');
  const runData   = buildDisciplineData('run');

  const totalData = yearSet.map(year => {
    const entry = summaryEntries.find(s => s.year === year);
    if (!entry) return { year, hasData: false, min: null, avg: null, median: null, max: null };
    return {
      year,
      hasData: entry.median !== null,
      min:    parseTimeSeconds(entry.min),
      avg:    parseTimeSeconds(entry.avg),
      median: parseTimeSeconds(entry.median),
      max:    parseTimeSeconds(entry.max),
    };
  });

  const hasSwim = swimData.some(d => d.hasData);
  const cols = hasSwim ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';

  return (
    <Section title={`${raceType} — Splits by Year`}>
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Total Finish Time</h4>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={totalData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatSeconds} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} reversed />
            <Tooltip content={<TimeTooltip />} />
            <Line type="monotone" dataKey="min"    name="Best"    stroke={color} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="median" name="Median"  stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} connectNulls={false} />
            <Line type="monotone" dataKey="max"    name="Slowest" stroke={color} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="avg"    name="Avg"     stroke={color} strokeWidth={1} strokeOpacity={0.4} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={`grid ${cols} gap-6`}>
        {hasSwim && <DisciplineChart title="Swim" discipline="swim" raceType={raceType} data={swimData} color={color} />}
        <DisciplineChart title="Bike" discipline="bike" raceType={raceType} data={bikeData} color={color} />
        <DisciplineChart title="Run"  discipline="run"  raceType={raceType} data={runData}  color={color} />
      </div>
    </Section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StatsView({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/summary').then(r => r.json()),
      fetch('/api/demographics').then(r => r.json()),
    ])
      .then(([s, d]) => { setSummary(s); setDemographics(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <svg className="h-8 w-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (!summary?.length) {
    return <div className="text-center text-slate-500 py-16">No data available.</div>;
  }

  const TAB_ORDER = ['Sprint', 'Olympic', 'Duathlon'];
  const raceTypes = [...new Set(summary.map(s => s.raceType))].sort(
    (a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b)
  );
  const yearSet = [...new Set(summary.map(s => s.year))].sort((a, b) => a - b);
  const currentTab = activeTab ?? raceTypes[0];

  const finisherData = yearSet.map(year => {
    const row = { year };
    for (const rt of raceTypes) {
      const entry = summary.find(s => s.year === year && s.raceType === rt);
      row[rt] = entry?.count ?? null;
    }
    return row;
  });

  const totalFinishers = summary.reduce((s, e) => s + e.count, 0);
  const totalYears = yearSet.length;
  const peakYear = finisherData.reduce((best, row) => {
    const total = raceTypes.reduce((s, rt) => s + (row[rt] || 0), 0);
    return total > best.total ? { year: row.year, total } : best;
  }, { year: null, total: 0 });
  const flagCount = Object.keys(ALL_FLAGS).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">Race Statistics</h2>
        <div className="w-16" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Finishers" value={totalFinishers.toLocaleString()} />
        <StatCard label="Years of Racing" value={totalYears} sub={`${yearSet[0]}–${yearSet[yearSet.length - 1]}`} />
        <StatCard label="Peak Year" value={peakYear.year} sub={`${peakYear.total} finishers`} />
        <StatCard label="Course Flags" value={flagCount} sub="anomalies noted" />
      </div>

      <Section title="Finishers per Year">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={finisherData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip content={<FinisherTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {raceTypes.map((rt, i) => (
              <Bar key={rt} dataKey={rt} stackId="a" fill={colorFor(rt)}
                radius={i === raceTypes.length - 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {demographics?.length > 0 && (
        <DemographicsSection
          demographics={demographics}
          yearSet={yearSet}
          raceTypes={raceTypes}
        />
      )}

      <div>
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {raceTypes.map(rt => (
            <button
              key={rt}
              onClick={() => setActiveTab(rt)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                currentTab === rt
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {rt}
            </button>
          ))}
        </div>
        <RaceTypeStats
          key={currentTab}
          raceType={currentTab}
          summaryEntries={summary.filter(s => s.raceType === currentTab)}
          yearSet={yearSet}
        />
      </div>
    </div>
  );
}
