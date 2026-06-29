import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadResults, queryResults, getRaceField, getAthleteResultsFromDb, upsertBySource, searchAthletes, getYearSummary, getDemographics, annotateWithDivisionRank, annotateWithTriScore, invalidateCache } from './data.js';
import { runFullScrape } from './scrapers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sub-path where the app is mounted (e.g. '/griskus' on ctkeane.com/griskus).
// Reads PASSENGER_BASE_URI set by cPanel; falls back to '/griskus' in production, empty in dev.
const rawBase = (process.env.APP_BASE_PATH ?? process.env.PASSENGER_BASE_URI ?? '').replace(/^\/|\/$/g, '');
const basePath = rawBase ? `/${rawBase}` : (process.env.NODE_ENV === 'production' ? '/griskus' : '');

const app = express();
app.use(cors());
app.use(express.json());

// In production Passenger manages the socket; serve the built React app from backend.
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '..', 'frontend', 'dist');
  if (basePath) app.use(basePath, express.static(distDir));
  app.use(express.static(distDir));
}

// All results with optional filters — filtering pushed to SQLite
app.get(`${basePath}/api/results`, (req, res) => {
  const { year, raceType, limit = 100, offset = 0 } = req.query;
  const { total, results } = queryResults({
    year:     year     ? parseInt(year, 10) : undefined,
    raceType: raceType || undefined,
    limit:    +limit,
    offset:   +offset,
  });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ total, offset: +offset, limit: +limit, results });
});

// Demographics: gender splits and age group counts per year+raceType
app.get(`${basePath}/api/demographics`, (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(getDemographics());
});

// Year/race summary
app.get(`${basePath}/api/summary`, async (req, res) => {
  const results = await loadResults();
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(getYearSummary(results));
});

// Search athletes by name
app.get(`${basePath}/api/athletes/search`, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  const results = await loadResults();
  const athletes = searchAthletes(results, q);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(athletes);
});

// Get all results for a specific athlete
app.get(`${basePath}/api/athletes/:lastName/:firstName`, (req, res) => {
  const { lastName, firstName } = req.params;
  const athleteResults = getAthleteResultsFromDb(firstName, lastName);
  if (!athleteResults.length) {
    return res.status(404).json({ error: 'No results found for this athlete' });
  }

  // Annotate each result with divRank/divTotal then triScore by fetching only the relevant race fields.
  const raceKeys = [...new Set(athleteResults.map(r => `${r.year}|${r.raceType}`))];
  const raceFieldMap = new Map();
  for (const key of raceKeys) {
    const [year, raceType] = key.split('|');
    const field = getRaceField(parseInt(year, 10), raceType);
    const withDiv = annotateWithDivisionRank(field);
    raceFieldMap.set(key, annotateWithTriScore(withDiv));
  }

  // Look up each athlete result in the annotated field to get its rank and score.
  const annotated = athleteResults.map(r => {
    const key = `${r.year}|${r.raceType}`;
    const field = raceFieldMap.get(key) || [];
    const match = field.find(f =>
      f.firstName === r.firstName && f.lastName === r.lastName &&
      f.totalTime === r.totalTime && f.bib === r.bib
    ) || field.find(f =>
      f.firstName === r.firstName && f.lastName === r.lastName && f.totalTime === r.totalTime
    );
    return match
      ? { ...r, divRank: match.divRank, divTotal: match.divTotal, triScore: match.triScore ?? null }
      : { ...r, divRank: null, divTotal: null, triScore: null };
  });

  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    firstName: annotated[0].firstName,
    lastName: annotated[0].lastName,
    fullName: annotated[0].fullName,
    results: annotated,
  });
});

// Trigger a fresh scrape
app.post(`${basePath}/api/scrape`, async (req, res) => {
  invalidateCache();
  res.json({ status: 'started', message: 'Scraping in progress...' });
  try {
    await runFullScrape();
    console.log('Scrape finished successfully');
  } catch (err) {
    console.error('Scrape error:', err);
  }
});

// Data health check
app.get(`${basePath}/api/status`, async (req, res) => {
  const results = await loadResults();
  const summary = getYearSummary(results);
  res.json({
    totalResults: results.length,
    years: summary.length,
    yearRange: results.length ? {
      min: Math.min(...results.map(r => r.year)),
      max: Math.max(...results.map(r => r.year)),
    } : null,
  });
});

// SPA fallback — must come after all /api routes
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '..', 'frontend', 'dist');
  app.get(`${basePath}*`, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Griskus API running on http://localhost:${PORT}`);
  console.log('No data cached yet — POST /api/scrape to load results');
});
