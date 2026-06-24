import axios from 'axios';

// FastTrackCoaching hosted plain-text result files
const TXT_RACES = [
  { year: 2010, type: 'Olympic', url: 'http://www.fasttrackcoaching.net/timing/Results/2010-PAT-GRISKUS-OLYMPIC-TRIATHLON-RESULTS.txt' },
  { year: 2010, type: 'Sprint', url: 'http://www.fasttrackcoaching.net/timing/Results/2010-PAT-GRISKUS-SPRINT-TRIATHLON-RESULTS.txt' },
  { year: 2011, type: 'Olympic', url: 'http://www.fasttrackcoaching.net/timing/Results/2011-PAT-GRISKUS-OLYMPIC-TRIATHLON-RESULTS.txt' },
  { year: 2011, type: 'Sprint', url: 'http://www.fasttrackcoaching.net/timing/Results/2011-PAT-GRISKUS-SPRINT-TRIATHLON-RESULTS.txt' },
  { year: 2012, type: 'Olympic', url: 'http://www.fasttrackcoaching.net/timing/Results/2012-PAT-GRISKUS-OLYMPIC-DISTANCE-TRIATHLON-RESULTS.txt' },
  { year: 2012, type: 'Sprint', url: 'http://www.fasttrackcoaching.net/timing/Results/2012-PAT-GRISKUS-SPRINT-DISTANCE-TRIATHLON-RESULTS.txt' },
  { year: 2013, type: 'Olympic', url: 'http://www.fasttrackcoaching.net/timing/Results/2013-PAT-GRISKUS-OLYMPIC-DISTANCE-TRIATHLON-RESULTS.txt' },
  { year: 2013, type: 'Sprint', url: 'http://www.fasttrackcoaching.net/timing/Results/2013-PAT-GRISKUS-SPRINT-DISTANCE-TRIATHLON-RESULTS.txt' },
];

// Fixed-width text format parser
// Lines look like:
//   1   SHERWOOD ALEXANDER        NEW PALTZ NY  30M M3034  2:06:18  7 23:36  1 1:07:15  2 0:35:27  186
// We detect columns by looking for the header line.
function parseTxtFile(text, year, raceType) {
  const lines = text.split('\n');
  const results = [];

  // Find the header line — it contains "PLACE" or "PL" and "NAME" or "LAST"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const upper = lines[i].toUpperCase();
    if ((upper.includes('PLACE') || upper.includes(' PL ')) && upper.includes('NAME')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Fallback: try tab or comma separated
    return parseDelimited(text, year, raceType);
  }

  const headerLine = lines[headerIdx];

  // Locate column positions by header keyword positions
  function colPos(keyword) {
    const idx = headerLine.toUpperCase().indexOf(keyword.toUpperCase());
    return idx === -1 ? null : idx;
  }

  const posPl = colPos('PLACE') ?? colPos(' PL ');
  const posName = colPos('NAME');
  const posCity = colPos('CITY');
  const posAge = colPos('AGE');
  const posTime = colPos('TIME') ?? colPos('FINISH');
  const posSwim = colPos('SWIM');
  const posBike = colPos('BIKE');
  const posRun = colPos('RUN');

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('-') || line.trim().startsWith('=')) continue;

    // Try to extract fields using character positions
    const placeStr = posPl !== null ? line.substring(posPl, posPl + 5).trim() : '';
    const place = parseInt(placeStr, 10) || null;
    if (!place) continue;

    const nameEnd = posCity !== null ? posCity : (posAge ?? 40);
    const fullName = posName !== null ? line.substring(posName, nameEnd).trim() : '';
    if (!fullName) continue;

    const nameParts = fullName.split(/\s+/);
    const lastName = nameParts[0] || '';
    const firstName = nameParts.slice(1).join(' ');

    const ageRaw = posAge !== null ? line.substring(posAge, posAge + 8).trim() : '';
    const ageMatch = ageRaw.match(/(\d+)\s*([MF])/i);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : null;
    const gender = ageMatch ? ageMatch[2].toUpperCase() : '';

    const totalTime = posTime !== null ? line.substring(posTime, posTime + 10).trim() : '';
    const swimTime = posSwim !== null ? line.substring(posSwim, posSwim + 8).trim() : '';
    const bikeTime = posBike !== null ? line.substring(posBike, posBike + 8).trim() : '';
    const runTime = posRun !== null ? line.substring(posRun, posRun + 8).trim() : '';

    results.push({
      year, raceType, source: 'fasttrack',
      place, firstName, lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      city: '', state: '', age, gender,
      division: '', totalTime, swimTime, bikeTime, runTime, bib: '',
    });
  }

  return results;
}

function parseDelimited(text, year, raceType) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toUpperCase());

  const idx = (keys) => {
    for (const k of keys) {
      const i = headers.findIndex(h => h.includes(k));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iPlace = idx(['PLACE', 'PL']);
  const iFirst = idx(['FIRST', 'FNAME']);
  const iLast = idx(['LAST', 'LNAME']);
  const iName = iFirst === -1 ? idx(['NAME']) : -1;
  const iCity = idx(['CITY']);
  const iState = idx(['STATE', 'ST']);
  const iAge = idx(['AGE']);
  const iGender = idx(['GENDER', 'SEX', ' M/F', 'S']);
  const iTotal = idx(['TIME', 'FINISH', 'TOTAL']);
  const iSwim = idx(['SWIM']);
  const iBike = idx(['BIKE']);
  const iRun = idx(['RUN']);

  const results = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const get = (i) => (i !== -1 && cells[i]) ? cells[i] : '';

    const placeStr = get(iPlace);
    const place = parseInt(placeStr, 10) || null;
    if (!place) continue;

    let firstName = '', lastName = '', fullName = '';
    if (iFirst !== -1 && iLast !== -1) {
      firstName = get(iFirst);
      lastName = get(iLast);
      fullName = `${firstName} ${lastName}`.trim();
    } else if (iName !== -1) {
      fullName = get(iName);
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ');
    }

    if (!fullName) continue;

    results.push({
      year, raceType, source: 'fasttrack',
      place, firstName, lastName, fullName,
      city: get(iCity), state: get(iState),
      age: parseInt(get(iAge), 10) || null,
      gender: get(iGender).toUpperCase(),
      division: '',
      totalTime: get(iTotal),
      swimTime: get(iSwim),
      bikeTime: get(iBike),
      runTime: get(iRun),
      bib: '',
    });
  }
  return results;
}

async function scrapeRace({ year, type, url }) {
  try {
    const resp = await axios.get(url, { timeout: 10000, responseType: 'text' });
    const rows = parseTxtFile(resp.data, year, type);
    console.log(`  FastTrack ${year} ${type}: ${rows.length} results`);
    return rows;
  } catch (err) {
    console.warn(`  FastTrack ${year} ${type} FAILED: ${err.message}`);
    return [];
  }
}

export async function scrapeFasttrack() {
  console.log('Scraping FastTrackCoaching TXT files (2010–2013)...');
  const allResults = [];
  for (const race of TXT_RACES) {
    const rows = await scrapeRace(race);
    allResults.push(...rows);
    await new Promise(r => setTimeout(r, 300));
  }
  return allResults;
}
