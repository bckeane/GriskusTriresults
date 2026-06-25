import { parseTimeSeconds as parseTS } from './time.js';

// Course distances — standard triathlon distances used at Griskus
const DISTANCES = {
  Sprint:   { swimYards: 820,   bikeMiles: 12.43, runMiles: 3.107 },
  Olympic:  { swimYards: 1640,  bikeMiles: 24.85, runMiles: 6.214 },
  Duathlon: { swimYards: 0,     bikeMiles: 24.85, runMiles: 6.214 },
};

// Returns seconds per 100y, or null.
export function swimPacePer100y(swimSecs, raceType) {
  const d = DISTANCES[raceType];
  if (!d || !d.swimYards || swimSecs == null || swimSecs <= 0) return null;
  return (swimSecs / d.swimYards) * 100;
}

// Returns miles per hour, or null.
export function bikeMPH(bikeSecs, raceType) {
  const d = DISTANCES[raceType];
  if (!d || bikeSecs == null || bikeSecs <= 0) return null;
  return (d.bikeMiles / bikeSecs) * 3600;
}

// Returns seconds per mile, or null.
export function runPacePerMile(runSecs, raceType) {
  const d = DISTANCES[raceType];
  if (!d || runSecs == null || runSecs <= 0) return null;
  return runSecs / d.runMiles;
}

// Format a pace (seconds) as M:SS.
export function formatPace(secs) {
  if (secs == null || !isFinite(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Format MPH to one decimal.
export function formatMPH(mph) {
  if (mph == null || !isFinite(mph)) return '—';
  return mph.toFixed(1);
}

// ---------------------------------------------------------------------------
// TriScore — 0–100 composite performance score (higher = better)
//
// Score = 0.5 × PlaceScore + 0.5 × PaceScore
//   PlaceScore: percentile within full field (100 = 1st place, ~0 = last)
//   PaceScore: weighted avg of discipline percentiles vs. the same race field
//              weights: swim 25%, bike 50%, run 25% (duathlon: bike 60%, run 40%)
//   agScore: percentile within same age-group division (display only, not in main score)
//
// Fallbacks:
//   No splits → score = PlaceScore only, placeOnly: true
//   No place  → score = PaceScore only,  paceOnly: true
//   Neither   → null
// ---------------------------------------------------------------------------

// Fraction of field that I beat (strictly), as a 0–100 score.
// higherIsBetter: true for bike MPH, false for swim/run pace.
function percentileScore(myValue, allValues, higherIsBetter) {
  if (!allValues.length) return null;
  const iBeaten = allValues.filter(v => higherIsBetter ? v < myValue : v > myValue).length;
  return (iBeaten / allValues.length) * 100;
}

// Normalize division strings to canonical form e.g. "M4044", matching backend logic.
const AGE_GROUP_RE = /^(?:DU-)?([MF])[\s-]?(\d{2})[\s-]?(\d{2})$/;
function normalizeDivision(div) {
  if (!div) return null;
  const m = div.trim().match(AGE_GROUP_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

// Compute age-group percentile for `result` within `fieldResults`.
// Groups by normalized division, ranks by totalTime, returns 0–100 or null.
function computeAgScore(result, fieldResults) {
  const myDiv = normalizeDivision(result.division);
  if (!myDiv) return null;

  const group = fieldResults.filter(r => normalizeDivision(r.division) === myDiv && r.totalTime != null);
  if (group.length < 2) return null;

  const sorted = [...group].sort((a, b) => {
    const as = parseTS(a.totalTime), bs = parseTS(b.totalTime);
    if (as === null && bs === null) return 0;
    if (as === null) return 1;
    if (bs === null) return -1;
    return as - bs;
  });

  const myRank = sorted.findIndex(r => r === result || (
    r.fullName === result.fullName && r.totalTime === result.totalTime
  ));
  if (myRank === -1) return null;

  return Math.max(0, Math.min(100, ((group.length - 1 - myRank) / (group.length - 1)) * 100));
}

export function computeTriScore(result, fieldResults) {
  const { place, swimTime, bikeTime, runTime, raceType } = result;
  const isDuathlon = raceType === 'Duathlon';

  // --- Place score ---
  const fieldWithPlace = fieldResults.filter(r => r.place != null);
  let placeScore = null;
  if (place != null && fieldWithPlace.length >= 1) {
    placeScore = fieldWithPlace.length === 1
      ? 100
      : Math.max(0, Math.min(100,
          ((fieldWithPlace.length - place) / (fieldWithPlace.length - 1)) * 100
        ));
  }

  // --- Pace score ---
  const swimSecs = parseTS(swimTime);
  const bikeSecs = parseTS(bikeTime);
  const runSecs  = parseTS(runTime);
  const hasSplits = swimSecs != null || bikeSecs != null || runSecs != null;

  let paceScore = null;
  if (hasSplits) {
    const weighted = [];

    // Swim (skip for Duathlon)
    if (!isDuathlon && swimSecs != null) {
      const fieldPaces = fieldResults
        .map(r => { const s = parseTS(r.swimTime); return s ? swimPacePer100y(s, raceType) : null; })
        .filter(v => v != null);
      const myPace = swimPacePer100y(swimSecs, raceType);
      if (myPace != null && fieldPaces.length > 1) {
        const s = percentileScore(myPace, fieldPaces, false);
        if (s != null) weighted.push({ s, w: 0.25 });
      }
    }

    // Bike
    if (bikeSecs != null) {
      const fieldMPHs = fieldResults
        .map(r => { const s = parseTS(r.bikeTime); return s ? bikeMPH(s, raceType) : null; })
        .filter(v => v != null);
      const myMPH = bikeMPH(bikeSecs, raceType);
      if (myMPH != null && fieldMPHs.length > 1) {
        const s = percentileScore(myMPH, fieldMPHs, true);
        if (s != null) weighted.push({ s, w: isDuathlon ? 0.6 : 0.5 });
      }
    }

    // Run
    if (runSecs != null) {
      const fieldPaces = fieldResults
        .map(r => { const s = parseTS(r.runTime); return s ? runPacePerMile(s, raceType) : null; })
        .filter(v => v != null);
      const myPace = runPacePerMile(runSecs, raceType);
      if (myPace != null && fieldPaces.length > 1) {
        const s = percentileScore(myPace, fieldPaces, false);
        if (s != null) weighted.push({ s, w: isDuathlon ? 0.4 : 0.25 });
      }
    }

    if (weighted.length > 0) {
      const totalW = weighted.reduce((sum, x) => sum + x.w, 0);
      paceScore = weighted.reduce((sum, x) => sum + x.s * (x.w / totalW), 0);
    }
  }

  const agRaw = computeAgScore(result, fieldResults);
  const agScore = agRaw != null ? Math.round(agRaw) : null;

  if (placeScore == null && paceScore == null) return null;
  if (placeScore == null) return { score: Math.round(paceScore), paceOnly: true, agScore };
  if (paceScore == null) return { score: Math.round(placeScore), placeOnly: true, agScore };

  return {
    score: Math.round(0.5 * placeScore + 0.5 * paceScore),
    placeScore: Math.round(placeScore),
    paceScore: Math.round(paceScore),
    agScore,
  };
}

// Compute pacing breakdown for a single result (for display in popovers).
export function computePacing(result) {
  const { swimTime, bikeTime, runTime, raceType } = result;
  const swimSecs = parseTS(swimTime);
  const bikeSecs = parseTS(bikeTime);
  const runSecs  = parseTS(runTime);
  return {
    swimPace: swimPacePer100y(swimSecs, raceType),
    mph:      bikeMPH(bikeSecs, raceType),
    runPace:  runPacePerMile(runSecs, raceType),
  };
}
