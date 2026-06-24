import axios from 'axios';

// RunSignUp race 146252 — used for 2023 and 2024 results
// TriSignUp (same race ID) — used for 2025

const RESULT_SETS = [
  { year: 2023, resultSetId: 387871 },
  { year: 2024, resultSetId: 465860 },
  { year: 2025, resultSetId: 558533 },
];

function mapGender(g) {
  if (!g) return '';
  const upper = String(g).toUpperCase();
  if (upper === 'M' || upper === 'MALE') return 'M';
  if (upper === 'F' || upper === 'FEMALE') return 'F';
  return upper;
}

function detectRaceType(eventName) {
  if (!eventName) return 'Unknown';
  const upper = eventName.toUpperCase();
  if (upper.includes('OLYMPIC') || upper.includes('OLY')) return 'Olympic';
  if (upper.includes('SPRINT')) return 'Sprint';
  if (upper.includes('DUATHLON') || upper.includes('DU')) return 'Duathlon';
  return eventName;
}

async function fetchResultSet(year, resultSetId) {
  const baseUrl = 'https://runsignup.com/Rest/race/146252/results/get-results';
  const params = {
    format: 'json',
    results_per_page: 500,
    page: 1,
    result_set_id: resultSetId,
  };

  try {
    const resp = await axios.get(baseUrl, { params, timeout: 15000 });
    const data = resp.data;

    // RunSignUp returns { race: { events: [...] } } or similar
    // Try multiple known response shapes
    let entries = [];
    if (Array.isArray(data)) {
      entries = data;
    } else if (data.results) {
      entries = Array.isArray(data.results) ? data.results : [];
    } else if (data.race?.race_results) {
      entries = data.race.race_results;
    } else if (data.result_set) {
      entries = data.result_set.results || [];
    }

    if (!entries.length) {
      console.warn(`  RunSignUp ${year} (set ${resultSetId}): empty response`);
      return [];
    }

    const raceType = detectRaceType(entries[0]?.event_name || entries[0]?.race_name || '');

    return entries.map(e => {
      const firstName = e.first_name || e.firstName || '';
      const lastName = e.last_name || e.lastName || '';
      return {
        year,
        raceType,
        source: 'runsignup',
        place: parseInt(e.place || e.overall_place || 0, 10) || null,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        city: e.city || '',
        state: e.state || '',
        age: parseInt(e.age || 0, 10) || null,
        gender: mapGender(e.gender),
        division: e.division || e.age_group || '',
        divPlace: parseInt(e.division_place || e.age_group_place || 0, 10) || null,
        totalTime: e.finish_time || e.chip_time || e.time || '',
        swimTime: e.swim_time || e.segment_1 || '',
        bikeTime: e.bike_time || e.segment_2 || '',
        runTime: e.run_time || e.segment_3 || '',
        bib: String(e.bib || e.bib_num || ''),
      };
    });
  } catch (err) {
    console.warn(`  RunSignUp ${year} (set ${resultSetId}) FAILED: ${err.message}`);
    return [];
  }
}

export async function scrapeRunsignup() {
  console.log('Scraping RunSignUp/TriSignUp (2023–2025)...');
  const allResults = [];
  for (const { year, resultSetId } of RESULT_SETS) {
    const rows = await fetchResultSet(year, resultSetId);
    console.log(`  RunSignUp ${year}: ${rows.length} results`);
    allResults.push(...rows);
    await new Promise(r => setTimeout(r, 500));
  }
  return allResults;
}
