import { useState, useEffect, useMemo } from 'react';
import { useSort } from '../hooks/useSort.js';
import { parseTimeSeconds, formatSeconds } from '../utils/time.js';

const COLUMNS = [
  { key: 'place',     label: '#',        align: 'left'  },
  { key: 'fullName',  label: 'Athlete',  align: 'left'  },
  { key: 'gender',    label: 'Gender',   align: 'left'  },
  { key: 'age',       label: 'Age',      align: 'right' },
  { key: 'division',  label: 'Division', align: 'left'  },
  { key: 'totalTime', label: 'Total',    align: 'right' },
  { key: 'swimTime',  label: 'Swim',     align: 'right' },
  { key: 'bikeTime',  label: 'Bike',     align: 'right' },
  { key: 'runTime',   label: 'Run',      align: 'right' },
];

export default function RaceResults({ year, raceType, onBack, onSelectAthlete }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/results?year=${year}&raceType=${encodeURIComponent(raceType)}&limit=10000`)
      .then(r => r.json())
      .then(d => setRows(d.results))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [year, raceType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.fullName?.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const { sorted, sort, toggle } = useSort(filtered, 'place');

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const withTime = rows.map(r => parseTimeSeconds(r.totalTime)).filter(t => t !== null).sort((a, b) => a - b);
    const mid = Math.floor(withTime.length / 2);
    const median = withTime.length ? Math.round(withTime.length % 2 === 0 ? (withTime[mid - 1] + withTime[mid]) / 2 : withTime[mid]) : null;
    const winner = [...rows].sort((a, b) => (a.place ?? 9999) - (b.place ?? 9999))[0];
    const males = rows.filter(r => r.gender === 'M').length;
    const females = rows.filter(r => r.gender === 'F').length;
    const ages = rows.map(r => r.age).filter(Boolean);
    const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;
    const states = [...new Set(rows.map(r => r.state).filter(Boolean))].length;
    const fastSwim = rows.map(r => parseTimeSeconds(r.swimTime)).filter(t => t !== null).sort((a, b) => a - b)[0] ?? null;
    const fastBike = rows.map(r => parseTimeSeconds(r.bikeTime)).filter(t => t !== null).sort((a, b) => a - b)[0] ?? null;
    const fastRun  = rows.map(r => parseTimeSeconds(r.runTime)).filter(t => t !== null).sort((a, b) => a - b)[0] ?? null;
    return { winner, males, females, median, avgAge, states, fastSwim, fastBike, fastRun };
  }, [rows]);

  const TYPE_COLOR = {
    Olympic:  'text-brand-800 bg-brand-100',
    Sprint:   'text-emerald-700 bg-emerald-100',
    Duathlon: 'text-finish-600 bg-finish-400/20',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <h2 className="font-display text-2xl font-bold text-brand-900 tracking-tight">{year}</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${TYPE_COLOR[raceType] ?? 'text-slate-700 bg-slate-100'}`}>
          {raceType}
        </span>
        {!loading && (
          <span className="text-sm text-slate-400 ml-auto">{sorted.length} finishers</span>
        )}
      </div>

      {/* Search filter */}
      <div className="relative max-w-xs">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by name..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Stat cards */}
      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <div className="col-span-2 rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Winner</div>
            <button
              onClick={() => onSelectAthlete({ firstName: stats.winner.firstName, lastName: stats.winner.lastName })}
              className="font-display text-base font-semibold text-brand-900 hover:text-brand-600 transition-colors text-left leading-tight tracking-tight"
            >
              {stats.winner.fullName}
            </button>
            <div className="text-xs text-slate-400 tabular-nums">{stats.winner.totalTime ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Finishers</div>
            <div className="font-display text-2xl font-bold text-brand-900">{rows.length}</div>
            <div className="text-[11px] text-slate-400">{stats.males}M · {stats.females}F</div>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Median Time</div>
            <div className="font-display text-2xl font-bold text-brand-900 tabular-nums">{formatSeconds(stats.median)}</div>
            <div className="text-[11px] text-slate-400">finish time</div>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Avg Age</div>
            <div className="font-display text-2xl font-bold text-brand-900">{stats.avgAge ?? '—'}</div>
            <div className="text-[11px] text-slate-400">{stats.states > 0 ? `${stats.states} states` : ''}</div>
          </div>
          {stats.fastSwim !== null && (
            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Fastest Swim</div>
              <div className="font-display text-2xl font-bold text-brand-900 tabular-nums">{formatSeconds(stats.fastSwim)}</div>
            </div>
          )}
          {stats.fastBike !== null && (
            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Fastest Bike</div>
              <div className="font-display text-2xl font-bold text-brand-900 tabular-nums">{formatSeconds(stats.fastBike)}</div>
            </div>
          )}
          {stats.fastRun !== null && (
            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Fastest Run</div>
              <div className="font-display text-2xl font-bold text-brand-900 tabular-nums">{formatSeconds(stats.fastRun)}</div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No results found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-medium cursor-pointer select-none hover:text-slate-800 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    onClick={() => toggle(col.key)}
                  >
                    {col.label}
                    <span className="ml-1">{sort.key === col.key ? (sort.dir === 'asc' ? '↑' : '↓') : <span className="text-slate-300">↕</span>}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums">{r.place ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onSelectAthlete({ firstName: r.firstName, lastName: r.lastName })}
                      className="font-medium text-slate-900 hover:text-brand-600 transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm"
                    >
                      {r.fullName}
                    </button>
                    {(r.city || r.state) && (
                      <div className="text-xs text-slate-400">{[r.city, r.state].filter(Boolean).join(', ')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.gender ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.age ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.division ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-medium text-slate-700 tabular-nums">{r.totalTime ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">{r.swimTime ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">{r.bikeTime ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">{r.runTime ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
