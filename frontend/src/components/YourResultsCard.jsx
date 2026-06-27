import { useState, useEffect } from 'react';
import { loadPin } from '../utils/pin.js';
import { api } from '../utils/api.js';

export default function YourResultsCard({ onSelectAthlete }) {
  const [pin, setPin] = useState(() => loadPin());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cross-tab sync: when another tab saves/clears the pin, update here
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'griskus_pin') setPin(loadPin());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!pin) { setResults(null); return; }
    setLoading(true);
    fetch(api(`/api/athletes/${encodeURIComponent(pin.lastName)}/${encodeURIComponent(pin.firstName)}`))
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [pin]);

  if (!pin) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-5 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
        <div className="h-6 w-48 bg-slate-200 rounded" />
      </div>
    );
  }
  if (!results || results.length === 0) return null;

  const mostRecentYear = Math.max(...results.map(r => r.year));
  const raceCount = results.length;

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 shadow-sm px-6 py-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-brand-500 uppercase mb-1">Your results</p>
      <button
        onClick={() => onSelectAthlete({ firstName: pin.firstName, lastName: pin.lastName })}
        className="text-left group"
      >
        <span className="font-display text-2xl font-bold text-brand-900 group-hover:text-brand-700 transition-colors">
          {pin.firstName} {pin.lastName}
        </span>
      </button>
      <p className="mt-1 text-sm text-slate-500">
        Most recent: {mostRecentYear}
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="text-slate-400 text-xs">
          {raceCount} race{raceCount !== 1 ? 's' : ''} (may include other athletes with this name)
        </span>
      </p>
    </div>
  );
}
