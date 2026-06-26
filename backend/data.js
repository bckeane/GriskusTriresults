import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSeconds, formatSeconds } from './time.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = join(__dirname, 'data', 'griskus.db');

let db = null;
let cache = null;

function getDb() {
  if (db) return db;
  if (!existsSync(DB_FILE)) return null;
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

export function loadResults() {
  if (cache) return cache;
  const conn = getDb();
  if (!conn) return [];
  cache = conn.prepare('SELECT * FROM results ORDER BY year, raceType, place').all();
  return cache;
}

// Filtered query pushed to SQLite — avoids loading the full table for filtered endpoints.
// filters: { year?, raceType?, limit?, offset? }
export function queryResults({ year, raceType, limit = 100, offset = 0 } = {}) {
  const conn = getDb();
  if (!conn) return { total: 0, results: [] };

  const where = [];
  const params = [];
  if (year != null) { where.push('year = ?'); params.push(year); }
  if (raceType != null) { where.push('raceType = ? COLLATE NOCASE'); params.push(raceType); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = conn.prepare(`SELECT COUNT(*) AS n FROM results ${whereClause}`).get(...params).n;
  const results = conn.prepare(
    `SELECT * FROM results ${whereClause} ORDER BY place, totalTime LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { total, results };
}

// Fetch the full field for one race (year + raceType) — used for per-race annotations.
export function getRaceField(year, raceType) {
  const conn = getDb();
  if (!conn) return [];
  return conn.prepare(
    'SELECT * FROM results WHERE year = ? AND raceType = ? COLLATE NOCASE ORDER BY place, totalTime'
  ).all(year, raceType);
}

// Upsert all records for a given source, leaving other sources untouched.
// This replaces the old saveResults() full-overwrite for scraper use.
export function upsertBySource(source, records) {
  const conn = getDb() ?? openDb();
  const del = conn.prepare('DELETE FROM results WHERE source = ?');
  const ins = conn.prepare(`
    INSERT OR REPLACE INTO results
      (year, raceType, source, place, firstName, lastName, fullName,
       city, state, age, gender, division, divPlace, totalTime, swimTime, bikeTime, runTime, bib)
    VALUES
      ($year, $raceType, $source, $place, $firstName, $lastName, $fullName,
       $city, $state, $age, $gender, $division, $divPlace, $totalTime, $swimTime, $bikeTime, $runTime, $bib)
  `);
  conn.exec('BEGIN');
  try {
    del.run(source);
    for (const r of records) {
      ins.run({
        $year:      r.year      ?? null,
        $raceType:  r.raceType  ?? null,
        $source:    source,
        $place:     r.place     ?? null,
        $firstName: r.firstName ?? null,
        $lastName:  r.lastName  ?? null,
        $fullName:  r.fullName  ?? null,
        $city:      r.city      ?? null,
        $state:     r.state     ?? null,
        $age:       r.age       ?? null,
        $gender:    r.gender    ?? null,
        $division:  r.division  ?? null,
        $divPlace:  r.divPlace  ?? null,
        $totalTime: r.totalTime ?? null,
        $swimTime:  r.swimTime  ?? null,
        $bikeTime:  r.bikeTime  ?? null,
        $runTime:   r.runTime   ?? null,
        $bib:       r.bib       ?? null,
      });
    }
    conn.exec('COMMIT');
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }
  invalidateCache();
}

function openDb() {
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id        INTEGER PRIMARY KEY,
      year      INTEGER NOT NULL,
      raceType  TEXT    NOT NULL,
      source    TEXT,
      place     INTEGER,
      firstName TEXT,
      lastName  TEXT,
      fullName  TEXT,
      city      TEXT,
      state     TEXT,
      age       INTEGER,
      gender    TEXT,
      division  TEXT,
      divPlace  INTEGER,
      totalTime TEXT,
      swimTime  TEXT,
      bikeTime  TEXT,
      runTime   TEXT,
      bib       TEXT,
      UNIQUE(year, raceType, fullName, totalTime)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_year_racetype ON results (year, raceType)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_name ON results (lastName, firstName)');
  return db;
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

// Direct DB lookup for one athlete — avoids loading the full table.
export function getAthleteResultsFromDb(firstName, lastName) {
  const conn = getDb();
  if (!conn) return [];
  return conn.prepare(
    `SELECT * FROM results WHERE firstName = ? COLLATE NOCASE AND lastName = ? COLLATE NOCASE
     ORDER BY year, raceType`
  ).all(firstName, lastName);
}

// Course distances used for TriScore pace computation
const DISTANCES = {
  Sprint:   { swimYards: 820,   bikeMiles: 12.43, runMiles: 3.107 },
  Olympic:  { swimYards: 1640,  bikeMiles: 24.85, runMiles: 6.214 },
  Duathlon: { swimYards: 0,     bikeMiles: 24.85, runMiles: 6.214 },
};

function percentileScore(myValue, allValues, higherIsBetter) {
  if (!allValues.length) return null;
  const iBeaten = allValues.filter(v => higherIsBetter ? v < myValue : v > myValue).length;
  return (iBeaten / allValues.length) * 100;
}

function computeTriScore(result, fieldResults) {
  const { place, swimTime, bikeTime, runTime, raceType, divRank, divTotal } = result;
  const isDuathlon = raceType === 'Duathlon';
  const dist = DISTANCES[raceType];
  if (!dist) return null;

  const fieldWithPlace = fieldResults.filter(r => r.place != null);
  let placeScore = null;
  if (place != null && fieldWithPlace.length >= 1) {
    placeScore = fieldWithPlace.length === 1
      ? 100
      : Math.max(0, Math.min(100,
          ((fieldWithPlace.length - place) / (fieldWithPlace.length - 1)) * 100
        ));
  }

  let agScore = null;
  if (divRank != null && divTotal != null && divTotal > 1) {
    agScore = Math.max(0, Math.min(100,
      ((divTotal - divRank) / (divTotal - 1)) * 100
    ));
  }

  const swimSecs = parseSeconds(swimTime);
  const bikeSecs = parseSeconds(bikeTime);
  const runSecs  = parseSeconds(runTime);
  const hasSplits = swimSecs != null || bikeSecs != null || runSecs != null;

  let paceScore = null;
  if (hasSplits) {
    const weighted = [];
    if (!isDuathlon && swimSecs != null && dist.swimYards) {
      const myPace = (swimSecs / dist.swimYards) * 100;
      const fieldPaces = fieldResults
        .map(r => { const s = parseSeconds(r.swimTime); return s ? (s / dist.swimYards) * 100 : null; })
        .filter(v => v != null);
      if (fieldPaces.length > 1) {
        const s = percentileScore(myPace, fieldPaces, false);
        if (s != null) weighted.push({ s, w: 0.25 });
      }
    }
    if (bikeSecs != null) {
      const myMPH = (dist.bikeMiles / bikeSecs) * 3600;
      const fieldMPHs = fieldResults
        .map(r => { const s = parseSeconds(r.bikeTime); return s ? (dist.bikeMiles / s) * 3600 : null; })
        .filter(v => v != null);
      if (fieldMPHs.length > 1) {
        const s = percentileScore(myMPH, fieldMPHs, true);
        if (s != null) weighted.push({ s, w: isDuathlon ? 0.6 : 0.5 });
      }
    }
    if (runSecs != null) {
      const myPace = runSecs / dist.runMiles;
      const fieldPaces = fieldResults
        .map(r => { const s = parseSeconds(r.runTime); return s ? s / dist.runMiles : null; })
        .filter(v => v != null);
      if (fieldPaces.length > 1) {
        const s = percentileScore(myPace, fieldPaces, false);
        if (s != null) weighted.push({ s, w: isDuathlon ? 0.4 : 0.25 });
      }
    }
    if (weighted.length > 0) {
      const totalW = weighted.reduce((sum, x) => sum + x.w, 0);
      paceScore = weighted.reduce((sum, x) => sum + x.s * (x.w / totalW), 0);
    }
  }

  if (placeScore == null && paceScore == null) return null;
  const agRounded = agScore != null ? Math.round(agScore) : null;
  if (placeScore == null) return { score: Math.round(paceScore), paceOnly: true, agScore: agRounded };
  if (paceScore == null) return { score: Math.round(placeScore), placeOnly: true, agScore: agRounded };
  return {
    score: Math.round(0.5 * placeScore + 0.5 * paceScore),
    placeScore: Math.round(placeScore),
    paceScore: Math.round(paceScore),
    agScore: agRounded,
  };
}

const AGE_GROUP_RE = /^(?:DU-)?([MF])[\s-]?(\d{2})[\s-]?(\d{2})$/;
function normalizeDivision(div) {
  if (!div) return null;
  const m = div.trim().match(AGE_GROUP_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

export function annotateWithDivisionRank(raceResults) {
  const groups = new Map();
  for (const r of raceResults) {
    const div = normalizeDivision(r.division);
    if (!div) continue;
    if (!groups.has(div)) groups.set(div, []);
    groups.get(div).push(r);
  }

  const rankMap = new Map();
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

export function annotateWithTriScore(raceResults) {
  return raceResults.map(r => {
    const ts = computeTriScore(r, raceResults);
    return ts != null ? { ...r, triScore: ts } : r;
  });
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

// Age bracket label for a given age (decade buckets, under-20 grouped).
function ageBracket(age) {
  if (age == null || age < 1) return null;
  if (age < 20) return 'U20';
  const decade = Math.floor(age / 10) * 10;
  return `${decade}s`;
}

// Returns per-year+raceType gender splits and age group counts.
// Shape: [{ year, raceType, male, female, other, ageGroups: { U20, '20s', '30s', ... } }]
export function getDemographics() {
  const conn = getDb();
  if (!conn) return [];

  const rows = conn.prepare(
    'SELECT year, raceType, gender, age FROM results ORDER BY year, raceType'
  ).all();

  const map = new Map();
  for (const r of rows) {
    const key = `${r.year}|${r.raceType}`;
    if (!map.has(key)) {
      map.set(key, { year: r.year, raceType: r.raceType, male: 0, female: 0, other: 0, ageGroups: {} });
    }
    const entry = map.get(key);
    const g = r.gender?.toUpperCase();
    if (g === 'M') entry.male++;
    else if (g === 'F') entry.female++;
    else if (g) entry.other++;

    const bracket = ageBracket(r.age);
    if (bracket) entry.ageGroups[bracket] = (entry.ageGroups[bracket] ?? 0) + 1;
  }

  return [...map.values()].sort((a, b) => b.year - a.year || a.raceType.localeCompare(b.raceType));
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
    best: total.length ? formatSeconds(Math.min(...total)) : null,
    disciplines: {
      swim: statsFor(swim),
      bike: statsFor(bike),
      run: statsFor(run),
    },
  })).sort((a, b) => b.year - a.year || a.raceType.localeCompare(b.raceType));
}
