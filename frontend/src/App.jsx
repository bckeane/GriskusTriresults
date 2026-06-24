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
  const athlete = params.get('athlete'); // "FirstName LastName" encoded as "LastName/FirstName"
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

  // Handle browser back/forward
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold text-slate-900 cursor-pointer hover:text-brand-700 transition-colors"
                onClick={handleBack}
              >
                Pat Griskus Triathlon
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Results archive · 1999–2025 · Waterbury, CT
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isHome && <SearchBar onSelect={handleSelectAthlete} />}
              <button
                onClick={handleViewStats}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
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
            <Suspense fallback={<div className="flex justify-center py-16"><svg className="h-8 w-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg></div>}>
              <StatsView onBack={handleBack} />
            </Suspense>
          </StatsErrorBoundary>
        ) : (
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white text-center shadow-lg">
              <h2 className="text-2xl font-bold mb-2">Find Your Results</h2>
              <p className="text-brand-100 mb-6 text-sm">
                Search across {status?.totalResults?.toLocaleString() || '...'} finisher records
                from {status?.yearRange ? `${status.yearRange.min}–${status.yearRange.max}` : '1999–2025'}
              </p>
              <div className="flex justify-center">
                <SearchBar onSelect={handleSelectAthlete} />
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
