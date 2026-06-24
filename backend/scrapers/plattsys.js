import axios from 'axios';
import * as cheerio from 'cheerio';

const RACES = [
  { year: 1999, type: 'Sprint', url: 'http://www.plattsys.com/results/res1999/grisk99.htm' },
  { year: 2000, type: 'Sprint', url: 'http://www.plattsys.com/results/res2000/gris00.htm' },
  { year: 2001, type: 'Sprint', url: 'http://www.plattsys.com/results/res2001/gris01.htm' },
  { year: 2002, type: 'Olympic', url: 'http://www.plattsys.com/results/res2002/griso02.htm' },
  { year: 2002, type: 'Sprint', url: 'http://www.plattsys.com/results/res2002/griskus02.htm' },
  { year: 2003, type: 'Olympic', url: 'http://www.plattsys.com/results/res2003/griso03.htm' },
  { year: 2003, type: 'Sprint', url: 'http://www.plattsys.com/results/res2003/gris03.htm' },
  { year: 2004, type: 'Olympic', url: 'http://www.plattsys.com/results/res2004/griso04.htm' },
  { year: 2004, type: 'Sprint', url: 'http://www.plattsys.com/results/res2004/griss04.htm' },
  { year: 2005, type: 'Olympic', url: 'http://www.plattsys.com/results/res2005/griso05.htm' },
  { year: 2005, type: 'Sprint', url: 'http://www.plattsys.com/results/res2005/griss05.htm' },
];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '');
}

// Extract column byte-ranges from a separator made of - or = characters
function colRanges(sep) {
  const ranges = [];
  let inBlock = false, start = 0;
  for (let i = 0; i <= sep.length; i++) {
    const ch = sep[i];
    if (ch === '-' || ch === '=') {
      if (!inBlock) { inBlock = true; start = i; }
    } else {
      if (inBlock) { ranges.push([start, i]); inBlock = false; }
    }
  }
  return ranges;
}

function sliceCols(line, ranges) {
  return ranges.map(([s, e]) => (line.substring(s, e) || '').trim());
}

// 1999–2001 format: ---- separator
// Columns: Rank | Time | Nmbr | Name | Division | DivRank | Swim | Bike | Run
function parse1999(preText, year, raceType) {
  const lines = preText.split('\n');
  const sepIdx = lines.findIndex(l => /^-{4,}/.test(l.trim()));
  if (sepIdx === -1) return [];

  const ranges = colRanges(lines[sepIdx]);
  if (ranges.length < 7) return [];

  const results = [];
  for (const line of lines.slice(sepIdx + 1)) {
    if (!line.trim() || /^-/.test(line.trim())) continue;
    const cols = sliceCols(line, ranges);
    const place = parseInt(cols[0], 10) || null;
    if (!place) continue;

    const fullName = cols[3] || '';
    if (!fullName) continue;

    const division = cols[4] || '';
    // Skip team entries
    if (division.toUpperCase().includes('TEAM')) continue;

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');
    if (!lastName) continue;

    const genderMatch = division.match(/\b([MF])\b|\b(MALE|FEMALE)\b/i);
    let gender = '';
    if (genderMatch) {
      const raw = (genderMatch[1] || genderMatch[2] || '').toUpperCase();
      gender = raw.startsWith('F') ? 'F' : 'M';
    }

    results.push({
      year, raceType, source: 'plattsys',
      place, firstName, lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      city: '', state: '', age: null, gender, division,
      totalTime: cols[1] || '',
      swimTime: cols[6] || '',
      bikeTime: cols[7] || '',
      runTime: cols[8] || '',
      bib: cols[2] || '',
    });
  }
  return results;
}

// 2003–2004 Olympic: ===== separator
// Columns: Place | Name | City | ST | Age | S | Swim | Bike | Run | Finish
function parse2003(preText, year, raceType) {
  const lines = preText.split('\n');
  const sepIdx = lines.findIndex(l => /={5,}/.test(l));
  if (sepIdx === -1) return [];

  const ranges = colRanges(lines[sepIdx]);
  if (ranges.length < 8) return [];

  const results = [];
  for (const line of lines.slice(sepIdx + 1)) {
    if (!line.trim() || /^=/.test(line.trim())) continue;
    const cols = sliceCols(line, ranges);
    const place = parseInt(cols[0], 10) || null;
    if (!place) continue;

    const fullName = cols[1] || '';
    if (!fullName) continue;

    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    results.push({
      year, raceType, source: 'plattsys',
      place, firstName, lastName,
      fullName: fullName.trim(),
      city: cols[2] || '',
      state: cols[3] || '',
      age: parseInt(cols[4], 10) || null,
      gender: (cols[5] || '').toUpperCase(),
      division: '',
      totalTime: cols[9] || cols[8] || '',
      swimTime: cols[6] || '',
      bikeTime: cols[7] || '',
      runTime: cols[8] || cols[7] || '',
      bib: '',
    });
  }
  return results;
}

// Columnar format (2000, 2002, 2003-sprint, 2004-sprint, 2005)
// Token-based parser — handles A/S column presence or absence
function parseColumnarLine(line) {
  const tokens = (line.match(/\S+/g) || []);
  if (tokens.length < 8) return null;

  let i = 0;

  // Place: first all-digit token
  const place = parseInt(tokens[i], 10);
  if (!place || isNaN(place)) return null;
  i++;

  // Last name: uppercase, may include hyphen
  const lastName = tokens[i];
  if (!lastName || !/^[A-Z]/.test(lastName)) return null;
  i++;

  // First name: next token; absorb optional middle initial (single letter + period)
  let firstName = tokens[i] || '';
  i++;
  if (tokens[i] && /^[A-Z]\.$/.test(tokens[i])) {
    firstName += ' ' + tokens[i++];
  }

  // Scan remaining tokens by type
  const times = [];
  let state = '', ageGender = '', division = '', divPlace = null, bib = '';
  const cityTokens = [];
  let foundState = false;
  let foundDiv = false;
  let foundDivPlace = false;

  const isTime = t => /^\d{1,2}:\d{2}(:\d{2})?$/.test(t);
  const isShortNum = t => /^\d{1,3}$/.test(t);
  const isDivision = t => /^[MF]\d{4}$/i.test(t);
  const isAgeGender = t => /^\d{2}[MF]$/i.test(t);
  const isState = t => /^[A-Z]{2}$/.test(t) && !isDivision(t);

  for (; i < tokens.length; i++) {
    const t = tokens[i];

    if (isTime(t)) {
      times.push(t);
      continue;
    }
    if (isDivision(t) && !foundDiv) {
      division = t.toUpperCase();
      foundDiv = true;
      continue;
    }
    if (isAgeGender(t) && !ageGender) {
      ageGender = t.toUpperCase();
      continue;
    }
    if (isState(t) && !foundState && cityTokens.length > 0) {
      state = t;
      foundState = true;
      continue;
    }
    if (foundDiv && !foundDivPlace && isShortNum(t)) {
      divPlace = parseInt(t, 10);
      foundDivPlace = true;
      continue;
    }
    if (times.length >= 3 && isShortNum(t)) {
      // Likely bib or a place ranking marker — keep last one as bib
      bib = t;
      continue;
    }
    if (isShortNum(t)) {
      // placement position markers (between times) — skip
      continue;
    }
    if (!foundState) {
      cityTokens.push(t);
    }
  }

  // Assign times: first H:MM:SS = total; then swim (MM:SS or 0:MM:SS); then bike (H:MM:SS); then run
  let totalTime = '', swimTime = '', bikeTime = '', runTime = '';
  const longTime = t => /^\d:\d{2}:\d{2}$/.test(t);
  const shortTime = t => /^\d{2}:\d{2}$/.test(t) || /^0:\d{2}:\d{2}$/.test(t);

  const totalIdx = times.findIndex(longTime);
  if (totalIdx !== -1) {
    totalTime = times[totalIdx];
    const after = times.slice(totalIdx + 1);
    // Filter out end/cumulative times by position:
    // after total: [swim, [bike], [endTime], run] or [swim, bike, run]
    const bikeIdx = after.findIndex(longTime);
    swimTime = after[0] || '';
    if (bikeIdx !== -1) {
      bikeTime = after[bikeIdx];
      // After bike: [endTime(cumulative), T2(optional), run]
      // Use the LAST time in the remaining sequence as run
      const afterBike = after.slice(bikeIdx + 1).filter(t => shortTime(t) || longTime(t));
      runTime = afterBike[afterBike.length - 1] || '';
    } else {
      runTime = after[after.length - 1] || '';
    }
  }

  const ageMatch = ageGender.match(/(\d{2})([MF])/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;
  const gender = ageMatch ? ageMatch[2].toUpperCase()
    : (division ? division[0].toUpperCase() : '');

  return {
    place, firstName, lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    city: cityTokens.join(' '),
    state, age, gender, division,
    divPlace: divPlace || null,
    totalTime, swimTime, bikeTime, runTime, bib,
  };
}

function parseColumnar(preText, year, raceType) {
  const lines = preText.split('\n');
  const results = [];

  for (const line of lines) {
    // Skip lines that are clearly headers or separators
    if (/PLACE|FIRST|LAST|OVERALL|===|---/i.test(line) && !/^\s*\d/.test(line)) continue;
    if (!line.trim() || line.trim().length < 20) continue;

    const parsed = parseColumnarLine(line);
    if (!parsed) continue;

    results.push({
      year, raceType, source: 'plattsys',
      ...parsed,
    });
  }
  return results;
}

function detectAndParse(preText, year, raceType) {
  if (/={5,}/.test(preText)) return parse2003(preText, year, raceType);
  if (/^-{4,}/m.test(preText) && /Rank/i.test(preText)) return parse1999(preText, year, raceType);
  return parseColumnar(preText, year, raceType);
}

async function scrapeRace({ year, type, url }) {
  try {
    const resp = await axios.get(url, { timeout: 12000 });
    const $ = cheerio.load(resp.data);

    // Find the largest pre block (the one with actual results)
    let biggestText = '';
    $('pre').each((_, el) => {
      const rawHtml = $(el).html() || '';
      const text = stripHtml(rawHtml);
      if (text.length > biggestText.length) biggestText = text;
    });

    if (!biggestText.trim()) {
      console.warn(`  PlatSys ${year} ${type}: no pre content`);
      return [];
    }

    const rows = detectAndParse(biggestText, year, type);
    // Filter: must have a name and reasonable place number
    const valid = rows.filter(r => r.firstName && r.lastName && r.place && r.place < 2000);
    console.log(`  PlatSys ${year} ${type}: ${valid.length} results`);
    return valid;
  } catch (err) {
    console.warn(`  PlatSys ${year} ${type} FAILED: ${err.message}`);
    return [];
  }
}

export async function scrapePlattsys() {
  console.log('Scraping PlatSys (1999–2005)...');
  const allResults = [];
  for (const race of RACES) {
    const rows = await scrapeRace(race);
    allResults.push(...rows);
    await new Promise(r => setTimeout(r, 400));
  }
  return allResults;
}
