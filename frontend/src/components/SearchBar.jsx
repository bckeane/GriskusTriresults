import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/athletes/search?q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const handleSelect = (athlete) => {
    setQuery(athlete.fullName);
    setOpen(false);
    onSelect(athlete);
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by athlete name..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base text-slate-900 shadow-sm placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
        {loading && (
          <div className="absolute inset-y-0 right-4 flex items-center">
            <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {results.map((athlete, i) => (
            <li key={i}>
              <button
                onMouseDown={() => handleSelect(athlete)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div>
                  <span className="font-medium text-slate-900">{athlete.fullName}</span>
                  {athlete.city && (
                    <span className="ml-2 text-sm text-slate-500">{athlete.city}{athlete.state ? `, ${athlete.state}` : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{athlete.raceCount} race{athlete.raceCount !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{athlete.years[0]}{athlete.years.length > 1 ? `–${athlete.years[athlete.years.length - 1]}` : ''}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm text-slate-500">
          No athletes found matching "{query}"
        </div>
      )}
    </div>
  );
}
