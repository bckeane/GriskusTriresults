import { scrapePlattsys } from './plattsys.js';
import { scrapeFasttrack } from './fasttrack.js';
import { scrapeRunsignup } from './runsignup.js';
import { saveResults } from '../data.js';

export async function runFullScrape() {
  console.log('Starting full scrape...\n');
  const start = Date.now();

  const [plattsys, fasttrack, runsignup] = await Promise.all([
    scrapePlattsys(),
    scrapeFasttrack(),
    scrapeRunsignup(),
  ]);

  const all = [...plattsys, ...fasttrack, ...runsignup];

  // Deduplicate and assign stable IDs
  const seen = new Set();
  const deduped = [];
  for (const r of all) {
    const key = `${r.year}-${r.raceType}-${r.fullName}-${r.totalTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({
        id: key.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''),
        ...r,
      });
    }
  }

  deduped.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.raceType !== b.raceType) return a.raceType.localeCompare(b.raceType);
    return (a.place ?? 9999) - (b.place ?? 9999);
  });

  await saveResults(deduped);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nScrape complete: ${deduped.length} results in ${elapsed}s`);
  return deduped;
}
