# TODOS

## T3 — Race Organizer Stats Dashboard

**What:** A new `/stats` route (or a Stats tab on the home page) showing: finisher count per year+raceType chart, gender split over time, age group participation trends, year-over-year growth.

**Why:** The race organizer is one of the two primary audiences identified in office-hours (alongside the multi-year veteran). They'd want shareable, at-a-glance data about the race's history.

**Pros:** All data is already in the backend. `/api/summary` provides counts + times. A simple bar chart per year for each race type is a one-afternoon build.

**Cons:** Needs design work — what does the organizer actually want to see? Risk of building generic analytics nobody uses. Should validate with an actual organizer first.

**Context:** Identified as second-tier audience in office-hours 2026-06-23. Deferred until the athlete visualization (T0, T1, T2, T4) is done.

**Depends on:** Nothing blocking, but validate demand before building.

---

## COMPLETED

- **T1** (2026-06-24) — Age group division rank: `annotateWithDivisionRank` in `backend/data.js`, `agScore` on athlete endpoint. Shown as dashed line in Performance Score chart.
- **T2** (2026-06-24) — Field median reference line: dashed line per race type on Finish Time History chart using `/api/summary` data.
- **T4** (2026-06-24) — TriScore trend line: solid line per race type on Performance Score chart (second panel below Finish Time History). Both panels share x-axis year range.
