import { useState, useEffect } from 'react';
import { useSort } from '../hooks/useSort.js';
import { api } from '../utils/api.js';

const TYPE_COLORS = {
  Olympic: 'text-blue-600 bg-blue-50',
  Sprint: 'text-emerald-600 bg-emerald-50',
  Duathlon: 'text-amber-600 bg-amber-50',
};

const PAGE_SIZE = 20;

export default function ResultsFeed({ onSelectAthlete }) {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const { sorted, sort, toggle } = useSort(results, 'place');

  useEffect(() => {
    setLoading(true);
    fetch(api(`/api/results?limit=${PAGE_SIZE}&offset=${offset}`))
      .then(r => r.json())
      .then(data => {
        setResults(data.results);
        setTotal(data.total);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [offset]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Results
          {total > 0 && <span className="ml-2 text-sm font-normal text-slate-400">{total.toLocaleString()} records</span>}
        </h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <svg className="h-6 w-6 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                {[['#','place','left'],['Athlete','fullName','left'],['Year','year','left'],['Race','raceType','left'],['Time','totalTime','right']].map(([label, key, align]) => (
                  <th
                    key={key}
                    onClick={() => toggle(key)}
                    className={`px-3 py-2.5 font-medium cursor-pointer select-none hover:text-slate-800 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {label}
                    <span className="ml-1">{sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : <span className="text-slate-300">↕</span>}</span>
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
                      className="font-medium text-slate-900 hover:text-brand-600 transition-colors text-left"
                    >
                      {r.fullName}
                    </button>
                    {(r.city || r.state) && (
                      <div className="text-xs text-slate-400">{[r.city, r.state].filter(Boolean).join(', ')}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 tabular-nums">{r.year}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[r.raceType] ?? 'text-slate-600 bg-slate-100'}`}>
                      {r.raceType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums font-mono text-xs">{r.totalTime ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset(o => o + PAGE_SIZE)}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
