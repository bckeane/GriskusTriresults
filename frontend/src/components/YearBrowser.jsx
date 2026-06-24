import { useState, useEffect } from 'react';

const RACE_TYPES = ['Olympic', 'Sprint', 'Duathlon'];

const TYPE_STYLES = {
  Olympic:  { dot: 'bg-blue-500',    header: 'text-blue-700',    tab: 'border-blue-500 text-blue-700',    tabInactive: 'text-slate-500 hover:text-blue-600' },
  Sprint:   { dot: 'bg-emerald-500', header: 'text-emerald-700', tab: 'border-emerald-500 text-emerald-700', tabInactive: 'text-slate-500 hover:text-emerald-600' },
  Duathlon: { dot: 'bg-amber-500',   header: 'text-amber-700',   tab: 'border-amber-500 text-amber-700',   tabInactive: 'text-slate-500 hover:text-amber-600' },
};

const EXTERNAL_LINKS = {
  '2025-Olympic':  'https://www.trisignup.com/Race/Results/146252#resultSetId-558533;perpage:100',
  '2025-Sprint':   'https://www.trisignup.com/Race/Results/146252#resultSetId-558533;perpage:100',
  '2025-Duathlon': 'https://www.trisignup.com/Race/Results/146252#resultSetId-558533;perpage:100',
  '2024-Olympic':  'https://runsignup.com/Race/Results/146252#resultSetId-465860;perpage:100',
  '2024-Sprint':   'https://runsignup.com/Race/Results/146252#resultSetId-465860;perpage:100',
  '2024-Duathlon': 'https://runsignup.com/Race/Results/146252#resultSetId-465860;perpage:100',
  '2023-Olympic':  'https://runsignup.com/Race/Results/146252#resultSetId-387871;perpage:100',
  '2023-Sprint':   'https://runsignup.com/Race/Results/146252#resultSetId-387871;perpage:100',
  '2023-Duathlon': 'https://runsignup.com/Race/Results/146252#resultSetId-387871;perpage:100',
  '2022-Olympic':  'https://www.iresultslive.com/results/?eid=5295',
  '2022-Sprint':   'https://www.iresultslive.com/results/?eid=5316',
  '2021-Olympic':  'https://www.iresultslive.com/results/?op=overall&eid=5002',
  '2019-Olympic':  'https://www.iresultslive.com/results/?eid=4270',
  '2019-Sprint':   'https://www.iresultslive.com/results/?op=overall&eid=4323',
  '2018-Olympic':  'https://www.iresultslive.com/results/?eid=3527',
  '2018-Sprint':   'https://www.iresultslive.com/results/?eid=3575',
  '2017-Olympic':  'https://www.iresultslive.com/results/?op=summary&eid=2725',
  '2017-Sprint':   'https://www.iresultslive.com/results/?op=summary&eid=2762',
  '2016-Sprint':   'http://fasttracktiming.com/race-result/pat-griskus-sprint-triathlon-4/#/results::1499130255703',
  '2015-Olympic':  'http://fasttracktiming.com/race-result/pat-griskus-olympic-distance-triathlon-and-duathlon/#/results::143485117384700',
  '2015-Sprint':   'http://fasttracktiming.com/race-result/pat-griskus-sprint-triathlon-3/#/results::1443144826195',
  '2009-Olympic':  'http://fasttrackcoaching.net/timing/Results/2009PatGriskusOlympicResults.pdf',
};

function RaceCard({ item, onViewRace }) {
  const extLink = item ? EXTERNAL_LINKS[`${item.year}-${item.raceType}`] : null;

  return (
    <div className={`h-28 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors flex flex-col justify-between ${item ? 'border-slate-200 hover:border-slate-300' : 'border-dashed border-slate-200'}`}>
      {item ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{item.count} finishers</span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onViewRace(item.year, item.raceType)}
                className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
              >
                Results
              </button>
              {extLink && (
                <a
                  href={extLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center"
                  title="External full results"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            {[['Best', item.best], ['Avg', item.avg], ['Median', item.median]].map(([label, val]) => (
              <div key={label} className="text-center">
                <div className="font-mono text-sm font-semibold text-slate-800 tabular-nums leading-tight">{val ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                <div className="text-[10px] text-slate-300 leading-none">finish time</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-xs text-slate-400">
          No results
        </div>
      )}
    </div>
  );
}

function RaceColumn({ raceType, years, byKey, onViewRace }) {
  const styles = TYPE_STYLES[raceType];
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className={`flex items-center gap-2 pb-2 border-b-2 ${styles.tab}`}>
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${styles.dot}`} />
        <span className="font-semibold text-sm">{raceType}</span>
      </div>
      {years.map(year => (
        <div key={year} className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-400 px-1">{year}</div>
          <RaceCard item={byKey[`${year}-${raceType}`] ?? null} onViewRace={onViewRace} />
        </div>
      ))}
    </div>
  );
}

export default function YearBrowser({ status, onViewRace }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Olympic');

  useEffect(() => {
    fetch('/api/summary')
      .then(r => r.json())
      .then(setSummary)
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, []);

  // Index by "year-raceType" and collect all years
  const byKey = {};
  const yearSet = new Set();
  for (const item of summary) {
    byKey[`${item.year}-${item.raceType}`] = item;
    yearSet.add(item.year);
  }
  const years = [...yearSet].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <svg className="h-6 w-6 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="text-4xl mb-3">🏊 🚴 🏃</div>
        <p className="text-slate-600 font-medium">No results loaded yet</p>
        <p className="text-sm text-slate-400 mt-1">Run the scraper to pull in results from all years</p>
        <button
          onClick={async () => {
            await fetch('/api/scrape', { method: 'POST' });
            setTimeout(() => window.location.reload(), 2000);
          }}
          className="mt-4 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 transition-colors"
        >
          Load Results Now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-brand-900 uppercase">
          All Races
          {status && <span className="ml-2 text-sm font-sans font-normal text-slate-400 normal-case tracking-normal">({status.totalResults.toLocaleString()} finishers)</span>}
        </h2>
      </div>

      {/* Desktop: 3 columns */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-6">
        {RACE_TYPES.map(rt => (
          <RaceColumn key={rt} raceType={rt} years={years} byKey={byKey} onViewRace={onViewRace} />
        ))}
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <div className="flex border-b border-slate-200 mb-4">
          {RACE_TYPES.map(rt => {
            const styles = TYPE_STYLES[rt];
            const active = activeTab === rt;
            return (
              <button
                key={rt}
                onClick={() => setActiveTab(rt)}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? styles.tab : 'border-transparent ' + styles.tabInactive}`}
              >
                {rt}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {years.map(year => (
            <div key={year} className="flex flex-col gap-1">
              <div className="text-xs font-semibold text-slate-400 px-1">{year}</div>
              <RaceCard item={byKey[`${year}-${activeTab}`] ?? null} onViewRace={onViewRace} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
