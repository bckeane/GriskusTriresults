import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'results.json');

let cache = null;

export async function loadResults() {
  if (cache) return cache;
  if (!existsSync(DATA_FILE)) return [];
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch {
    return [];
  }
}

export async function saveResults(results) {
  cache = results;
  await writeFile(DATA_FILE, JSON.stringify(results, null, 2), 'utf-8');
}

export function invalidateCache() {
  cache = null;
}

// Search athletes by partial name match (case-insensitive)
export function searchAthletes(results, query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const athleteMap = new Map();

  for (const r of results) {
    const key = `${r.lastName.toLowerCase()}|${r.firstName.toLowerCase()}`;
    if (!athleteMap.has(key)) {
      athleteMap.set(key, {
        firstName: r.firstName,
        lastName: r.lastName,
        fullName: r.fullName,
        raceCount: 0,
        years: new Set(),
      });
    }
    const a = athleteMap.get(key);
    a.raceCount++;
    a.years.add(r.year);
  }

  const athletes = [...athleteMap.values()].map(a => ({
    ...a,
    years: [...a.years].sort(),
  }));

  return athletes
    .filter(a => a.fullName.toLowerCase().includes(q) ||
                 a.lastName.toLowerCase().includes(q) ||
                 a.firstName.toLowerCase().includes(q))
    .sort((a, b) => {
      // Exact last name match first
      const aLast = a.lastName.toLowerCase() === q;
      const bLast = b.lastName.toLowerCase() === q;
      if (aLast && !bLast) return -1;
      if (!aLast && bLast) return 1;
      return a.lastName.localeCompare(b.lastName);
    })
    .slice(0, 25);
}

export function getAthleteResults(results, firstName, lastName) {
  const fn = firstName.toLowerCase();
  const ln = lastName.toLowerCase();
  return results
    .filter(r => r.firstName.toLowerCase() === fn && r.lastName.toLowerCase() === ln)
    .sort((a, b) => a.year - b.year || a.raceType.localeCompare(b.raceType));
}

// Normalize division strings to a canonical form like "M4044", or null if not an age-group division.
// Handles: M4044, M 40-44, M40-44, DU-M4044, DU-F 35-39, etc.
const AGE_GROUP_RE = /^(?:DU-)?([MF])[\s-]?(\d{2})[\s-]?(\d{2})$/;
function normalizeDivision(div) {
  if (!div) return null;
  const m = div.trim().match(AGE_GROUP_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

// Given all results for a race (same year+raceType), annotate each result with
// divRank (1-based place within their normalized division) and divTotal (field size).
// Results with no parseable division get divRank/divTotal = null.
export function annotateWithDivisionRank(raceResults) {
  // Group by normalized division
  const groups = new Map();
  for (const r of raceResults) {
    const div = normalizeDivision(r.division);
    if (!div) continue;
    if (!groups.has(div)) groups.set(div, []);
    groups.get(div).push(r);
  }

  // Sort each group by totalTime (nulls last), assign rank
  const rankMap = new Map(); // result object → { divRank, divTotal }
  for (const [, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const as = parseSeconds(a.totalTime), bs = parseSeconds(b.totalTime);
      if (as === null && bs === null) return 0;
      if (as === null) return 1;
      if (bs === null) return -1;
      return as - bs;
    });
    const divTotal = sorted.length;
    sorted.forEach((r, i) => rankMap.set(r, { divRank: i + 1, divTotal }));
  }

  return raceResults.map(r => {
    const rank = rankMap.get(r);
    return rank ? { ...r, divRank: rank.divRank, divTotal: rank.divTotal } : { ...r, divRank: null, divTotal: null };
  });
}

function parseSeconds(t) {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatSeconds(s) {
  if (s == null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function statsFor(times) {
  if (times.length === 0) return { min: null, max: null, avg: null, median: null };
  times.sort((a, b) => a - b);
  const min = formatSeconds(times[0]);
  const max = formatSeconds(times[times.length - 1]);
  const avg = formatSeconds(Math.round(times.reduce((s, t) => s + t, 0) / times.length));
  const mid = Math.floor(times.length / 2);
  const median = formatSeconds(times.length % 2 === 0
    ? Math.round((times[mid - 1] + times[mid]) / 2)
    : times[mid]);
  return { min, max, avg, median };
}

export function getYearSummary(results) {
  const map = new Map();
  for (const r of results) {
    const key = `${r.year}-${r.raceType}`;
    if (!map.has(key)) {
      map.set(key, {
        year: r.year, raceType: r.raceType, count: 0, source: r.source,
        total: [], swim: [], bike: [], run: [],
      });
    }
    const entry = map.get(key);
    entry.count++;
    const t = parseSeconds(r.totalTime);  if (t != null) entry.total.push(t);
    const s = parseSeconds(r.swimTime);   if (s != null) entry.swim.push(s);
    const b = parseSeconds(r.bikeTime);   if (b != null) entry.bike.push(b);
    const rn = parseSeconds(r.runTime);   if (rn != null) entry.run.push(rn);
  }

  return [...map.values()].map(({ total, swim, bike, run, ...entry }) => ({
    ...entry,
    ...statsFor(total),
    // Legacy field names kept for backwards compat
    best: total.length ? formatSeconds(Math.min(...total)) : null,
    disciplines: {
      swim: statsFor(swim),
      bike: statsFor(bike),
      run: statsFor(run),
    },
  })).sort((a, b) => b.year - a.year || a.raceType.localeCompare(b.raceType));
}
