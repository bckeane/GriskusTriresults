import express from 'express';
import cors from 'cors';
import { loadResults, searchAthletes, getAthleteResults, getYearSummary, annotateWithDivisionRank, invalidateCache } from './data.js';
import { runFullScrape } from './scrapers/index.js';

const app = express();
app.use(cors());
app.use(express.json());

// All results with optional filters
app.get('/api/results', async (req, res) => {
  const results = await loadResults();
  let filtered = results;

  const { year, raceType, limit = 100, offset = 0 } = req.query;
  if (year) filtered = filtered.filter(r => r.year === parseInt(year, 10));
  if (raceType) filtered = filtered.filter(r => r.raceType.toLowerCase() === raceType.toLowerCase());

  res.json({
    total: filtered.length,
    offset: +offset,
    limit: +limit,
    results: filtered.slice(+offset, +offset + +limit),
  });
});

// Year/race summary
app.get('/api/summary', async (req, res) => {
  const results = await loadResults();
  res.json(getYearSummary(results));
});

// Search athletes by name
app.get('/api/athletes/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  const results = await loadResults();
  const athletes = searchAthletes(results, q);
  res.json(athletes);
});

// Get all results for a specific athlete
app.get('/api/athletes/:lastName/:firstName', async (req, res) => {
  const { lastName, firstName } = req.params;
  const results = await loadResults();
  const athleteResults = getAthleteResults(results, firstName, lastName);
  if (!athleteResults.length) {
    return res.status(404).json({ error: 'No results found for this athlete' });
  }

  // Annotate each result with divRank/divTotal by computing rank within the full race field.
  const raceKeys = [...new Set(athleteResults.map(r => `${r.year}|${r.raceType}`))];
  const raceFieldMap = new Map();
  for (const key of raceKeys) {
    const [year, raceType] = key.split('|');
    const field = results.filter(r => r.year === parseInt(year, 10) && r.raceType === raceType);
    raceFieldMap.set(key, annotateWithDivisionRank(field));
  }

  // Look up each athlete result in the annotated field to get its rank.
  const annotated = athleteResults.map(r => {
    const key = `${r.year}|${r.raceType}`;
    const field = raceFieldMap.get(key) || [];
    const match = field.find(f =>
      f.firstName === r.firstName && f.lastName === r.lastName &&
      f.totalTime === r.totalTime && f.bib === r.bib
    ) || field.find(f =>
      f.firstName === r.firstName && f.lastName === r.lastName && f.totalTime === r.totalTime
    );
    return match ? { ...r, divRank: match.divRank, divTotal: match.divTotal } : { ...r, divRank: null, divTotal: null };
  });

  res.json({
    firstName: annotated[0].firstName,
    lastName: annotated[0].lastName,
    fullName: annotated[0].fullName,
    results: annotated,
  });
});

// Trigger a fresh scrape
app.post('/api/scrape', async (req, res) => {
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
app.get('/api/status', async (req, res) => {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Griskus API running on http://localhost:${PORT}`);
  console.log('No data cached yet — POST /api/scrape to load results');
});
