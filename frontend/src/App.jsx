import { useState, useEffect, lazy, Suspense, Component } from 'react';
import { api } from './utils/api.js';
import SearchBar from './components/SearchBar.jsx';
import AthleteView from './components/AthleteView.jsx';
import YearBrowser from './components/YearBrowser.jsx';
import RaceResults from './components/RaceResults.jsx';
import YourResultsCard from './components/YourResultsCard.jsx';

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
    fetch(api('/api/status'))
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
      <header className="bg-brand-900 sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4 h-13 flex items-center justify-between gap-4" style={{ height: '52px' }}>
          <button
            onClick={handleBack}
            className="text-left group"
          >
            <div className="font-display text-xl font-bold tracking-wide text-white uppercase leading-none group-hover:text-brand-200 transition-colors">
              Griskus
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleViewStats}
              className="text-sm text-white/60 hover:text-white transition-colors whitespace-nowrap font-medium"
            >
              Race Stats
            </button>
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
            <YourResultsCard onSelectAthlete={handleSelectAthlete} />
            {/* Hero: bold finisher count statement */}
            <div className="bg-brand-900 rounded-2xl px-8 py-10 text-white relative">
              {/* Lake Quassapaug outline — the race venue, ghosted into the card */}
              <svg aria-hidden="true" viewBox="0 0 207 300" className="absolute inset-y-4 right-6 h-[calc(100%-2rem)] w-auto max-w-[45%] select-none pointer-events-none opacity-20" preserveAspectRatio="xMaxYMid meet">
                <path d="M 10.00,160.79 L 22.79,195.24 L 41.06,202.06 L 59.84,220.81 L 73.49,225.19 L 78.23,258.18 L 69.98,275.38 L 55.82,285.63 L 70.68,288.20 L 83.96,277.53 L 89.53,261.52 L 91.69,273.39 L 99.76,286.50 L 113.60,281.19 L 119.22,273.13 L 136.75,262.59 L 144.21,253.86 L 154.44,244.32 L 156.45,247.42 L 160.20,248.25 L 158.80,244.41 L 161.87,236.52 L 163.65,222.76 L 165.09,213.77 L 175.68,206.34 L 180.39,198.75 L 182.67,191.26 L 184.13,178.68 L 182.54,156.41 L 179.72,142.07 L 178.28,137.77 L 168.87,130.11 L 161.97,123.27 L 159.73,117.96 L 157.13,114.99 L 157.27,109.30 L 154.92,101.52 L 157.25,95.64 L 158.73,83.04 L 156.54,75.95 L 156.87,67.43 L 155.96,59.09 L 153.99,51.79 L 151.16,34.99 L 148.64,14.34 L 135.42,13.19 L 125.81,27.28 L 114.85,33.89 L 123.91,43.02 L 132.86,51.18 L 140.90,68.02 L 141.16,76.42 L 133.86,93.01 L 140.30,99.38 L 137.19,114.42 L 139.28,118.33 L 141.71,129.48 L 141.15,136.20 L 138.62,142.78 L 135.35,145.12 L 130.56,146.31 L 126.78,147.09 L 120.70,145.88 L 115.62,145.54 L 108.20,148.50 L 95.22,147.53 L 88.13,147.91 L 87.74,143.61 L 85.00,137.06 L 81.29,126.83 L 77.69,120.95 L 79.12,141.36 L 74.20,152.14 L 69.39,151.24 L 61.79,158.81 L 58.70,167.02 L 51.41,180.97 L 41.88,187.34 L 37.82,151.31 L 56.93,96.61 L 51.83,75.82 L 34.09,130.89 L 10.64,158.09 L 10.00,160.79 Z" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="3" strokeLinejoin="round" />
              </svg>
              <div className="relative">
                <div className="font-display text-[72px] sm:text-[96px] font-bold leading-none text-white tracking-tight">
                  {totalResults ? totalResults.toLocaleString() : '—'}
                </div>
                <div className="font-display text-base sm:text-lg font-medium text-brand-300 tracking-[0.15em] uppercase mt-1">
                  Finisher records
                </div>
                <div className="mt-6 text-brand-200 text-sm">
                  {yearRange ? `${yearRange.min}–${yearRange.max}` : '1999–2025'} · Middlebury, Connecticut
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
