# TODOS

## T8 — Stat Card Context for Data-Sparse Athletes

**What:** When an athlete has no age group rank data, the "Best Div Rank" stat card shows "—" with no explanation. For pre-2017 athletes or first-timers, multiple stat cards show dashes. Add a context sub-label for data-absent cases — e.g., a `StatCard` sub prop of `"age group data from 2017+"` when `bestDivPlace` is null and `results.length > 0`.

**Why:** A dash is universally understood as "no data," but not why there's no data. Returning athletes from the 1990s–2000s who see "Best Div Rank: —" might assume the feature is broken rather than that the data source didn't track it.

**Pros:** Makes the data coverage gap visible and friendly rather than appearing broken. Low-complexity — `StatCard` already accepts a `sub` prop.

**Cons:** Requires knowing the data coverage rules per field (div rank: 2017+, estimated miles: any year with known distance). Slight copy-writing burden to get the messages right without being condescending.

**Context:** Surfaced during design review of Full Athlete Identity Panel (2026-06-26). Part of the first-timer experience pass.

**Depends on:** Nothing. Can be done standalone.

---

## T3 — Race Organizer Stats Dashboard

**What:** A new `/stats` route (or a Stats tab on the home page) showing: finisher count per year+raceType chart, gender split over time, age group participation trends, year-over-year growth.

**Why:** The race organizer is one of the two primary audiences identified in office-hours (alongside the multi-year veteran). They'd want shareable, at-a-glance data about the race's history.

**Pros:** All data is already in the backend. `/api/summary` provides counts + times. A simple bar chart per year for each race type is a one-afternoon build.

**Cons:** Needs design work — what does the organizer actually want to see? Risk of building generic analytics nobody uses. Should validate with an actual organizer first.

**Context:** Identified as second-tier audience in office-hours 2026-06-23. Deferred until the athlete visualization (T0, T1, T2, T4) is done.

**Depends on:** Nothing blocking, but validate demand before building.

---

## T4 — Vitest Test Infrastructure

**What:** Add Vitest + @testing-library/react. Write unit tests for `frontend/src/utils/pin.js` (pure functions, easy to test), the claim toggle state in `AthleteView.jsx`, and the render states of `YourResultsCard.jsx`.

**Why:** The localStorage pin feature introduces the first real unit-testable utilities in the project. `loadPin()`, `savePin()`, and `clearPin()` are pure I/O functions with defined edge cases (malformed JSON, empty names, QuotaExceededError) that are currently unverified.

**Pros:** Vitest is the natural fit for a Vite+React project — zero config. `pin.js` tests can be written in under 30 minutes. Prevents regressions when v2 (magic link) changes the pin schema.

**Cons:** Adds a dev dependency. The project has shipped without tests so far. If the codebase stays small, the cost may not be worth the maintenance.

**Context:** Identified during eng review of the athlete claiming feature (2026-06-26). 23 code paths with no test coverage.

**Depends on:** Nothing. Can be added standalone.

---

## T5 — Magic Link v2 (Cross-Device Athlete Identity)

**What:** When an athlete has pinned themselves via localStorage, show an "Save across devices" prompt. Clicking it asks for their email, sends a one-time magic link, and on click creates an `athlete_accounts` row in the DB mapping `email → {firstName, lastName, claimId}`. On return visits from any device, a session cookie identifies the athlete and populates the pin automatically.

**Why:** The v1 localStorage pin is device-bound. An athlete who pins themselves on their laptop won't see the YourResultsCard on their phone. Magic link auth solves this with no passwords.

**Pros:** Enables future email notifications (new race year results, PR alerts). The `claimId: null` field in the v1 pin schema is already the hook — no schema migration needed. Solves name collision properly (claimId maps to specific result IDs, not just a name).

**Cons:** Requires email sending infrastructure (Postmark/Resend/nodemailer). Adds a session/cookie layer to the Express server — new security surface. Estimated M effort (2-3 sessions).

**Context:** v2 direction established in office-hours design doc (2026-06-26). The pin format is explicitly designed to be upgrade-compatible. When magic link ships, `savePin()` gains an optional `claimId` param; existing pins upgrade silently on next save.

**Depends on:** T_claiming (localStorage pin feature — must be shipped first).

---

## T7 — DisciplineRadar Placeholder: Source-Specific Coverage Messaging

**What:** Audit which years have complete (swimTime + bikeTime + runTime) splits per scrape source, and update the DisciplineRadar placeholder text to be specific about why data is missing. Currently: "Not enough split data to show your Discipline DNA yet." Could be: "Split data is available for races from 2017 onward. Race more to unlock your Discipline DNA."

**Why:** The current placeholder text implies the athlete hasn't raced enough, when often the limitation is the data source (pre-2017 plattsys/Athlinks sources are split-incomplete). Clearer messaging reduces confusion for long-tenured athletes.

**Pros:** Improves UX for athletes who've raced since the 1990s but see the placeholder. Easy to implement once the source/year/split coverage is audited.

**Cons:** The "2017 onward" threshold isn't perfectly accurate (2021 Athlinks Sprint has splits, some 2009–2016 Athlinks data has partial splits). May need per-source investigation. Low-urgency polish.

**Context:** Surfaced during eng review of Full Athlete Identity Panel (2026-06-27). Outside voice noted ~87% of qualifying athletes hit the placeholder due to data coverage.

**Depends on:** DisciplineRadar component shipped.

---

## COMPLETED

- **T1** (2026-06-24) — Age group division rank: `annotateWithDivisionRank` in `backend/data.js`, `agScore` on athlete endpoint. Shown as dashed line in Performance Score chart.
- **T2** (2026-06-24) — Field median reference line: dashed line per race type on Finish Time History chart using `/api/summary` data.
- **T6** (2026-06-24) — TriScore trend line: solid line per race type on Performance Score chart (second panel below Finish Time History). Both panels share x-axis year range.
