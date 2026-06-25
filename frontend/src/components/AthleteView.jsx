import { useState, lazy, Suspense } from 'react';
import { useSort } from '../hooks/useSort.js';
import { computePacing, formatPace, formatMPH } from '../utils/pace.js';

const TimelineChart = lazy(() => import('./TimelineChart.jsx'));

const RACE_TYPE_COLORS = {
  Olympic:  'bg-blue-100 text-blue-800',
  Sprint:   'bg-emerald-100 text-emerald-800',
  Duathlon: 'bg-amber-100 text-amber-800',
  Unknown:  'bg-slate-100 text-slate-600',
};

const RACE_TYPE_HEADER = {
  Olympic:  'border-blue-400 text-blue-700',
  Sprint:   'border-emerald-400 text-emerald-700',
  Duathlon: 'border-amber-400 text-amber-700',
};

function Badge({ label }) {
  const cls = RACE_TYPE_COLORS[label] || RACE_TYPE_COLORS.Unknown;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
      <div className="font-display text-3xl font-bold text-brand-900 leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      <div className="text-xs text-slate-500 mt-0.5 tracking-wide">{label}</div>
    </div>
  );
}

function SortableTh({ label, colKey, sort, toggle, align = 'left', title }) {
  const active = sort.key === colKey;
  return (
    <th
      onClick={() => toggle(colKey)}
      title={title}
      className={`py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-800 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {label}
      <span className="ml-1">{active ? (sort.dir === 'asc' ? '↑' : '↓') : <span className="text-slate-300">↕</span>}</span>
    </th>
  );
}

function scoreColor(score) {
  if (score == null) return 'text-slate-400';
  if (score >= 75)   return 'text-emerald-600 font-semibold';
  if (score >= 50)   return 'text-brand-700 font-semibold';
  if (score >= 25)   return 'text-slate-600';
  return 'text-slate-400';
}

// Hover popover showing pace breakdown and TriScore detail.
// ts = the full triScore object ({ score, placeScore, paceScore, agScore, placeOnly?, paceOnly? }) or null.
// anchor = 'center' | 'right' — controls popover horizontal position.
function TriScorePopover({ result, ts, anchor = 'center', tdCls = 'py-3 px-4 text-sm tabular-nums' }) {
  const [open, setOpen] = useState(false);
  const pacing = computePacing(result);

  const score = ts?.score ?? null;
  const hasPacing = pacing.swimPace != null || pacing.mph != null || pacing.runPace != null;

  if (score == null && !hasPacing) {
    return <td className={`${tdCls} text-xs text-slate-300`}>—</td>;
  }

  const clr = scoreColor(score);
  const popoverAnchor = anchor === 'right'
    ? 'absolute bottom-full right-0 mb-2'
    : 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2';
  const arrowAnchor = anchor === 'right'
    ? 'absolute -bottom-1.5 right-4 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45'
    : 'absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45';

  return (
    <td className={tdCls}>
      <div className={anchor === 'right' ? 'relative inline-block' : 'relative'}>
        <button
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={`${clr} cursor-default underline decoration-dotted underline-offset-2`}
        >
          {score != null ? score : '—'}
        </button>

        {open && (
          <div className={`${popoverAnchor} z-50 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-left pointer-events-none`}>
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>TriScore breakdown</span>
              {score != null && <span className={`text-base ${clr}`}>{score}</span>}
            </div>

            {hasPacing && (
              <div className="space-y-1.5 text-xs">
                {pacing.swimPace != null && (
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Swim</span>
                    <span className="tabular-nums font-medium">{formatPace(pacing.swimPace)}<span className="text-slate-400 font-normal">/100y</span></span>
                  </div>
                )}
                {pacing.mph != null && (
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Bike</span>
                    <span className="tabular-nums font-medium">{formatMPH(pacing.mph)}<span className="text-slate-400 font-normal"> mph</span></span>
                  </div>
                )}
                {pacing.runPace != null && (
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Run</span>
                    <span className="tabular-nums font-medium">{formatPace(pacing.runPace)}<span className="text-slate-400 font-normal">/mi</span></span>
                  </div>
                )}
              </div>
            )}

            {ts?.placeScore != null && ts?.paceScore != null && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Place %ile</span>
                  <span className="tabular-nums">{ts.placeScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pace %ile</span>
                  <span className="tabular-nums">{ts.paceScore}</span>
                </div>
                {ts.agScore != null && (
                  <div className="flex justify-between">
                    <span>Age group %ile</span>
                    <span className="tabular-nums">{ts.agScore}</span>
                  </div>
                )}
              </div>
            )}

            {ts?.placeOnly && <div className="mt-2 text-xs text-slate-400 italic">Place only — no splits</div>}
            {ts?.paceOnly && <div className="mt-2 text-xs text-slate-400 italic">Pace only — no place data</div>}
            <div className={arrowAnchor} />
          </div>
        )}
      </div>
    </td>
  );
}

function RaceTypeTable({ raceType, results }) {
  // Flatten triScore to numeric for sort; preserve full object in triScoreData
  const flatRows = results.map(r => ({
    ...r,
    triScoreData: r.triScore,
    triScore: r.triScore?.score ?? null,
  }));
  const { sorted, sort, toggle } = useSort(flatRows, 'year', 'asc');
  const headerCls = RACE_TYPE_HEADER[raceType] ?? 'border-slate-400 text-slate-700';

  if (results.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`px-4 py-2.5 border-b-2 ${headerCls} flex items-center justify-between`}>
        <Badge label={raceType} />
        <span className="text-xs text-slate-400">{results.length} race{results.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTh label="Year"     colKey="year"      sort={sort} toggle={toggle} />
              <SortableTh label="Overall"  colKey="place"     sort={sort} toggle={toggle} />
              <SortableTh label="Div"      colKey="divRank"   sort={sort} toggle={toggle} />
              <SortableTh label="Swim"     colKey="swimTime"  sort={sort} toggle={toggle} />
              <SortableTh label="Bike"     colKey="bikeTime"  sort={sort} toggle={toggle} />
              <SortableTh label="Run"      colKey="runTime"   sort={sort} toggle={toggle} />
              <SortableTh label="Total"    colKey="totalTime" sort={sort} toggle={toggle} />
              <SortableTh label="Age"      colKey="age"       sort={sort} toggle={toggle} />
              <SortableTh
                label="Score"
                colKey="triScore"
                sort={sort}
                toggle={toggle}
                title="TriScore: 0–100 composite of field place percentile + pace percentile. Hover for breakdown."
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-slate-900">{r.year}</td>
                <td className="py-3 px-4 text-sm text-slate-700">
                  {r.place != null ? (
                    <span className={r.place <= 3 ? 'font-bold text-finish-600' : ''}>#{r.place}</span>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-sm text-slate-500">
                  {r.divRank != null
                    ? <span className={r.divRank <= 3 ? 'font-semibold text-finish-600' : ''}>{r.divRank}/{r.divTotal}</span>
                    : <span title={r.division || ''}>{r.division || '—'}</span>}
                </td>
                <td className="py-3 px-4 text-sm text-slate-700 tabular-nums">{r.swimTime || '—'}</td>
                <td className="py-3 px-4 text-sm text-slate-700 tabular-nums">{r.bikeTime || '—'}</td>
                <td className="py-3 px-4 text-sm text-slate-700 tabular-nums">{r.runTime || '—'}</td>
                <td className="py-3 px-4 text-sm font-semibold text-slate-900 tabular-nums">{r.totalTime || '—'}</td>
                <td className="py-3 px-4 text-xs text-slate-400">{r.age || '—'}</td>
                <TriScorePopover result={r} ts={r.triScoreData} anchor="right" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { TriScorePopover };

export default function AthleteView({ firstName, lastName, onBack }) {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/athletes/${encodeURIComponent(lastName)}/${encodeURIComponent(firstName)}`).then(r => r.json()),
      fetch('/api/summary').then(r => r.json()),
    ])
      .then(([d, s]) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setSummary(s);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [firstName, lastName]);

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

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  const { results = [] } = data || {};
  const years = [...new Set(results.map(r => r.year))].sort();
  const bestPlace = Math.min(...results.filter(r => r.place).map(r => r.place));

  // Best TriScore across all races — triScore arrives from backend now
  const allScores = results
    .map(r => r.triScore ? { score: r.triScore.score, year: r.year, raceType: r.raceType } : null)
    .filter(Boolean);
  const bestTri = allScores.length > 0 ? allScores.reduce((a, b) => b.score > a.score ? b : a) : null;

  const byType = {
    Olympic:  results.filter(r => r.raceType === 'Olympic'),
    Sprint:   results.filter(r => r.raceType === 'Sprint'),
    Duathlon: results.filter(r => r.raceType === 'Duathlon'),
  };

  // Adaptive 4th stat card: Best TriScore when available, otherwise most-raced type count
  const mostRacedType = Object.entries(byType).reduce((a, b) => b[1].length > a[1].length ? b : a);
  const fourthCard = bestTri
    ? { label: 'Best TriScore', value: bestTri.score, sub: `${bestTri.year} ${bestTri.raceType}` }
    : { label: mostRacedType[0], value: mostRacedType[1].length, sub: undefined };

  const shareUrl = `${window.location.origin}?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;

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
          Back to search
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(shareUrl)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          title="Copy link to this athlete"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          Copy link
        </button>
      </div>

      {/* Athlete nameplate */}
      <div className="border-t-2 border-brand-900 pt-4">
        <h2 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-brand-900 leading-none">
          {data?.fullName?.toUpperCase()}
        </h2>
        <p className="mt-2 font-display text-sm tracking-[0.2em] text-slate-400 uppercase">
          {years.length > 0 && `${years[0]}${years.length > 1 ? ` – ${years[years.length - 1]}` : ''}`}
          {results.length > 0 && ` · ${results.length} race${results.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Races" value={results.length} />
        <StatCard label="Best Finish" value={isFinite(bestPlace) ? `#${bestPlace}` : '—'} />
        <StatCard label="Olympic" value={byType.Olympic.length} />
        <StatCard label={fourthCard.label} value={fourthCard.value} sub={fourthCard.sub} />
      </div>

      <Suspense fallback={<div className="h-[252px] rounded-xl border border-slate-200 bg-white shadow-sm animate-pulse" />}>
        <TimelineChart results={results} summary={summary} />
      </Suspense>

      <RaceTypeTable raceType="Olympic"  results={byType.Olympic} />
      <RaceTypeTable raceType="Sprint"   results={byType.Sprint} />
      <RaceTypeTable raceType="Duathlon" results={byType.Duathlon} />
    </div>
  );
}
