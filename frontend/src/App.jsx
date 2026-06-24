import { useState, useEffect, lazy, Suspense, Component } from 'react';
import SearchBar from './components/SearchBar.jsx';
import AthleteView from './components/AthleteView.jsx';
import YearBrowser from './components/YearBrowser.jsx';
import RaceResults from './components/RaceResults.jsx';

const StatsView = lazy(() => import('./components/StatsView.jsx'));

class StatsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-16 text-center">
          <p className="text-slate-500 mb-4">Race stats failed to load.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-sm text-brand-600 hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const lastName = params.get('lastName');
  const firstName = params.get('firstName');
  const year = params.get('year');
  const raceType = params.get('raceType');
  const view = params.get('view');

  if (lastName && firstName) return { view: 'athlete', firstName, lastName };
  if (year && raceType) return { view: 'race', year: parseInt(year, 10), raceType };
  if (view === 'stats') return { view: 'stats' };
  return { view: 'home' };
}

function pushRoute(params) {
  const url = params ? `?${new URLSearchParams(params).toString()}` : '/';
  window.history.pushState(null, '', url);
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleSelectAthlete = (athlete) => {
    const params = { firstName: athlete.firstName, lastName: athlete.lastName };
    pushRoute(params);
    setRoute({ view: 'athlete', ...params });
  };

  const handleViewRace = (year, raceType) => {
    pushRoute({ year, raceType });
    setRoute({ view: 'race', year, raceType });
  };

  const handleBack = () => {
    pushRoute(null);
    setRoute({ view: 'home' });
  };

  const handleViewStats = () => {
    pushRoute({ view: 'stats' });
    setRoute({ view: 'stats' });
  };

  const isHome = route.view === 'home';
  const totalResults = status?.totalResults;
  const yearRange = status?.yearRange;

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleBack}
              className="text-left group"
            >
              <div className="font-display text-2xl font-bold tracking-tight text-brand-900 leading-none group-hover:text-brand-700 transition-colors">
                Pat Griskus
              </div>
              <div className="font-display text-xs font-500 tracking-[0.2em] text-slate-400 uppercase mt-0.5">
                Triathlon · Waterbury CT
              </div>
            </button>
            <div className="flex items-center gap-3">
              {isHome && (
                <div className="hidden sm:block">
                  <SearchBar onSelect={handleSelectAthlete} />
                </div>
              )}
              <button
                onClick={handleViewStats}
                className="text-sm text-slate-500 hover:text-brand-700 transition-colors whitespace-nowrap font-medium"
              >
                Race Stats
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {route.view === 'athlete' ? (
          <AthleteView
            firstName={route.firstName}
            lastName={route.lastName}
            onBack={handleBack}
          />
        ) : route.view === 'race' ? (
          <RaceResults
            year={route.year}
            raceType={route.raceType}
            onBack={handleBack}
            onSelectAthlete={handleSelectAthlete}
          />
        ) : route.view === 'stats' ? (
          <StatsErrorBoundary>
            <Suspense fallback={
              <div className="flex justify-center py-16">
                <svg className="h-8 w-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            }>
              <StatsView onBack={handleBack} />
            </Suspense>
          </StatsErrorBoundary>
        ) : (
          /* Home view */
          <div className="space-y-8">
            {/* Hero: bold finisher count statement */}
            <div className="bg-brand-900 rounded-2xl px-8 py-10 text-white relative">
              {/* Subtle texture: discipline letters anchored to bottom-right of the card */}
              <div className="absolute bottom-0 right-0 flex gap-1 opacity-[0.08] select-none pointer-events-none overflow-hidden rounded-br-2xl" style={{height: '100%', maxWidth: '40%'}} aria-hidden="true">
                <span className="font-display text-[130px] font-bold leading-none">S</span>
                <span className="font-display text-[130px] font-bold leading-none">B</span>
                <span className="font-display text-[130px] font-bold leading-none">R</span>
              </div>
              <div className="relative">
                <div className="font-display text-[72px] sm:text-[96px] font-bold leading-none text-white tracking-tight">
                  {totalResults ? totalResults.toLocaleString() : '—'}
                </div>
                <div className="font-display text-base sm:text-lg font-medium text-brand-300 tracking-[0.15em] uppercase mt-1">
                  Finisher records
                </div>
                <div className="mt-6 text-brand-200 text-sm">
                  {yearRange ? `${yearRange.min}–${yearRange.max}` : '1999–2025'} · Waterbury, Connecticut
                </div>
                <div className="mt-5 sm:hidden">
                  <SearchBar onSelect={handleSelectAthlete} />
                </div>
                <div className="hidden sm:block mt-5 max-w-md">
                  <SearchBar onSelect={handleSelectAthlete} />
                </div>
              </div>
            </div>

            <YearBrowser status={status} onViewRace={handleViewRace} />
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Pat Griskus Triathlon Series · Results data sourced from official race timing providers
      </footer>
    </div>
  );
}
