import { scrapePlattsys } from './plattsys.js';
import { scrapeFasttrack } from './fasttrack.js';
import { scrapeRunsignup } from './runsignup.js';
import { upsertBySource } from '../data.js';

export async function runFullScrape() {
  console.log('Starting full scrape...\n');
  const start = Date.now();

  const [plattsys, fasttrack, runsignup] = await Promise.allSettled([
    scrapePlattsys(),
    scrapeFasttrack(),
    scrapeRunsignup(),
  ]);

  // Each source is upserted independently — a failure in one doesn't wipe the others.
  const sources = [
    { key: 'plattsys',   result: plattsys },
    { key: 'fasttrack',  result: fasttrack },
    { key: 'runsignup',  result: runsignup },
  ];

  let total = 0;
  for (const { key, result } of sources) {
    if (result.status === 'rejected') {
      console.error(`  ${key} scraper failed — existing DB rows preserved:`, result.reason?.message ?? result.reason);
      continue;
    }
    const records = result.value ?? [];
    if (records.length === 0) {
      console.log(`  ${key}: 0 results — skipping upsert, existing rows preserved`);
      continue;
    }
    upsertBySource(key, records);
    console.log(`  ${key}: upserted ${records.length} records`);
    total += records.length;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nScrape complete: ${total} records upserted in ${elapsed}s`);
}
