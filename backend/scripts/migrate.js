#!/usr/bin/env node
/**
 * Repeatable JSON → SQLite migration.
 *
 * Reads backend/data/results.json and upserts every record into the SQLite DB.
 * Safe to re-run: INSERT OR REPLACE deduplicates on (year, raceType, fullName, totalTime).
 * Rows from sources not present in the JSON are preserved (partial upsert, not a wipe).
 *
 * After upsert, runs a cross-source merge pass to collapse rows where two sources
 * recorded the same athlete in the same race with times that differ by ≤2 seconds.
 * The merge keeps the more-authoritative source's place/time and fills in splits
 * from whichever row has them.
 *
 * Usage:
 *   node backend/scripts/migrate.js
 *   node backend/scripts/migrate.js --wipe   # drop and recreate table first
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSeconds } from '../time.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_FILE = join(__dirname, '..', 'data', 'results.json');
const DB_FILE   = join(__dirname, '..', 'data', 'griskus.db');

const wipe = process.argv.includes('--wipe');

if (!existsSync(JSON_FILE)) {
  console.error(`results.json not found at ${JSON_FILE}`);
  console.error('Run the Python scraper first: cd python_scraper && python3 scrape_all.py');
  process.exit(1);
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (wipe) {
  console.log('--wipe: dropping existing results table');
  db.exec('DROP TABLE IF EXISTS results');
}

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

// ---------------------------------------------------------------------------
// Phase 1: upsert from JSON
// ---------------------------------------------------------------------------
const records = JSON.parse(readFileSync(JSON_FILE, 'utf-8'));
console.log(`Loaded ${records.length} records from results.json`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO results
    (year, raceType, source, place, firstName, lastName, fullName,
     city, state, age, gender, division, divPlace, totalTime, swimTime, bikeTime, runTime, bib)
  VALUES
    (@year, @raceType, @source, @place, @firstName, @lastName, @fullName,
     @city, @state, @age, @gender, @division, @divPlace, @totalTime, @swimTime, @bikeTime, @runTime, @bib)
`);

const upsertMany = db.transaction((rows) => {
  let count = 0;
  for (const r of rows) {
    insert.run({
      year:      r.year      ?? null,
      raceType:  r.raceType  ?? null,
      source:    r.source    ?? null,
      place:     r.place     ?? null,
      firstName: r.firstName ?? null,
      lastName:  r.lastName  ?? null,
      fullName:  r.fullName  ?? null,
      city:      r.city      ?? null,
      state:     r.state     ?? null,
      age:       r.age       ?? null,
      gender:    r.gender    ?? null,
      division:  r.division  ?? null,
      divPlace:  r.divPlace  ?? null,
      totalTime: r.totalTime ?? null,
      swimTime:  r.swimTime  ?? null,
      bikeTime:  r.bikeTime  ?? null,
      runTime:   r.runTime   ?? null,
      bib:       r.bib       ?? null,
    });
    count++;
  }
  return count;
});

let start = Date.now();
const upserted = upsertMany(records);
console.log(`Upserted ${upserted} records in ${((Date.now() - start) / 1000).toFixed(2)}s`);

// ---------------------------------------------------------------------------
// Phase 2: cross-source merge
//
// When two sources cover the same year+raceType, athletes appear twice with
// times that differ by exactly 1 second (timing system rounding between chip
// time and gun time). We merge these pairs:
//   - PRIMARY source (usat, then iresultslive, then athlinks, then web_archive)
//     contributes: place, totalTime, bib, division, divPlace, city, state
//   - SPLITS source (web_archive, then iresultslive, then athlinks)
//     contributes: swimTime, bikeTime, runTime
//   - The secondary row is deleted.
//
// Match criterion: same year + raceType + fullName + |timeDiff| ≤ 2 seconds.
// ---------------------------------------------------------------------------

// Higher index = more authoritative for place/time
const PLACE_AUTHORITY = ['web_archive', 'fasttrack', 'athlinks', 'iresultslive', 'plattsys', 'usat'];
// Higher index = preferred source for splits
const SPLITS_AUTHORITY = ['plattsys', 'usat', 'athlinks', 'iresultslive', 'web_archive', 'fasttrack'];

function authority(source, ranking) {
  const i = ranking.indexOf(source);
  return i === -1 ? -1 : i;
}

// Find year+raceType combos that have more than one source
const multiSourceRaces = db.prepare(`
  SELECT year, raceType, GROUP_CONCAT(DISTINCT source) as sources
  FROM results
  GROUP BY year, raceType
  HAVING COUNT(DISTINCT source) > 1
`).all();

if (multiSourceRaces.length === 0) {
  console.log('No multi-source races found — skipping merge pass');
} else {
  console.log(`\nMerge pass: ${multiSourceRaces.length} race(s) with multiple sources`);

  const updateRow = db.prepare(`
    UPDATE results SET
      source    = @source,
      place     = @place,
      totalTime = @totalTime,
      swimTime  = @swimTime,
      bikeTime  = @bikeTime,
      runTime   = @runTime,
      division  = @division,
      divPlace  = @divPlace,
      city      = @city,
      state     = @state,
      bib       = @bib,
      age       = @age,
      gender    = @gender
    WHERE id = @id
  `);
  const deleteRow = db.prepare('DELETE FROM results WHERE id = ?');

  const mergeAll = db.transaction(() => {
    let merged = 0;
    let deleted = 0;

    for (const { year, raceType } of multiSourceRaces) {
      const rows = db.prepare(
        'SELECT * FROM results WHERE year = ? AND raceType = ? ORDER BY fullName, place'
      ).all(year, raceType);

      // Group by fullName
      const byName = new Map();
      for (const r of rows) {
        if (!byName.has(r.fullName)) byName.set(r.fullName, []);
        byName.get(r.fullName).push(r);
      }

      for (const [, group] of byName) {
        if (group.length < 2) continue;

        // Find pairs where times are within 2 seconds of each other
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            if (a._merged || b._merged) continue;

            const tA = parseSeconds(a.totalTime);
            const tB = parseSeconds(b.totalTime);
            if (tA === null || tB === null) continue;
            if (Math.abs(tA - tB) > 2) continue;

            // These are the same athlete — merge them.
            // Pick the more authoritative source for place/time fields.
            const placeWinner = authority(a.source, PLACE_AUTHORITY) >= authority(b.source, PLACE_AUTHORITY) ? a : b;
            const splitsWinner = authority(a.source, SPLITS_AUTHORITY) >= authority(b.source, SPLITS_AUTHORITY) ? a : b;
            const keep = placeWinner; // we update this row in-place
            const drop = keep === a ? b : a;

            updateRow.run({
              id:        keep.id,
              source:    `${placeWinner.source}+${splitsWinner.source === placeWinner.source ? '' : splitsWinner.source}`.replace(/\+$/, ''),
              place:     placeWinner.place,
              totalTime: placeWinner.totalTime,
              swimTime:  splitsWinner.swimTime  || placeWinner.swimTime  || null,
              bikeTime:  splitsWinner.bikeTime  || placeWinner.bikeTime  || null,
              runTime:   splitsWinner.runTime   || placeWinner.runTime   || null,
              division:  placeWinner.division   || drop.division         || null,
              divPlace:  placeWinner.divPlace   ?? drop.divPlace         ?? null,
              city:      placeWinner.city       || drop.city             || null,
              state:     placeWinner.state      || drop.state            || null,
              bib:       placeWinner.bib        || drop.bib              || null,
              age:       placeWinner.age        ?? drop.age              ?? null,
              gender:    placeWinner.gender     || drop.gender           || null,
            });
            deleteRow.run(drop.id);

            a._merged = true;
            b._merged = true;
            merged++;
            deleted++;
          }
        }
      }
    }
    return { merged, deleted };
  });

  start = Date.now();
  const { merged, deleted } = mergeAll();
  console.log(`Merged ${merged} pairs, deleted ${deleted} duplicate rows in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

const { total } = db.prepare('SELECT COUNT(*) AS total FROM results').get();
console.log(`\nFinal DB: ${total} rows`);
db.close();
