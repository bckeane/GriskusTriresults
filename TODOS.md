# TODOS

## T1 — Age Group Division Rank Trend (Approach B)

**What:** Add server-side age group rank computation to the athlete endpoint. For each result, compute `divRank` (how the athlete placed within their division, e.g., 3rd out of 12 in M40-44 that year) and `divTotal` (total finishers in that division that year).

**Why:** Division rank is the stat veterans actually quote to each other — "I went from 7th to 2nd in my age group" is a story. Overall place is distorted by field size variation across years.

**Pros:** The data is all there. `getAgeGroupRank()` in `backend/data.js` is ~20 lines. Frontend shows it as a stat or second chart line.

**Cons:** Division strings are inconsistent across data sources/years (e.g., "M40-44" vs. "M 40-44" vs. missing). Requires a data quality audit before the rank is trustworthy. Medium effort.

**Context:** Designed and explicitly deferred in office-hours session 2026-06-23. Chart-only (Approach A) ships first; this is Approach B.

**Depends on:** TimelineChart (T0) shipped and working. Division field audit.

---

## T2 — Field Median Reference Line (Approach C)

**What:** Add a reference line to the athlete's TimelineChart showing the median finish time for each year+raceType. Uses existing `/api/summary` endpoint data (already computed server-side).

**Why:** Shows the athlete's trend relative to the field: "The field got 3 minutes faster between 2010 and 2018, and so did you — you held your percentile." That's the "whoa" version of the chart.

**Pros:** `/api/summary` data is already fetched on the home page. Could be fetched once in AthleteView on mount (a second, cached API call).

**Cons:** Two series on the same chart (athlete line + median reference) needs careful UX design. The median reference could make the chart cluttered. Should only show for years with actual athlete data.

**Context:** Approach C from the office-hours design. Explicitly deferred until Approach A + B are proven useful.

**Depends on:** Age group rank (T1) not required, but chart should be polished first.

---

## T3 — Race Organizer Stats Dashboard

**What:** A new `/stats` route (or a Stats tab on the home page) showing: finisher count per year+raceType chart, gender split over time, age group participation trends, year-over-year growth.

**Why:** The race organizer is one of the two primary audiences identified in office-hours (alongside the multi-year veteran). They'd want shareable, at-a-glance data about the race's history.

**Pros:** All data is already in the backend. `/api/summary` provides counts + times. A simple bar chart per year for each race type is a one-afternoon build.

**Cons:** Needs design work — what does the organizer actually want to see? Risk of building generic analytics nobody uses. Should validate with an actual organizer first.

**Context:** Identified as second-tier audience in office-hours 2026-06-23. Deferred until the athlete visualization (T0, T1, T2) is done.

**Depends on:** Nothing blocking, but validate demand before building.
