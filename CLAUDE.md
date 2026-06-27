# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both servers concurrently from the repo root
npm run dev

# Backend only (nodemon, port controlled by BACKEND_PORT env var, default 3731)
cd backend && npm run dev

# Frontend only (Vite, auto-picks a free port)
cd frontend && npm run dev

# Run the Python scraper (preferred — covers all historical sources)
cd python_scraper && python scrape_all.py

# After running the Python scraper, migrate results.json → griskus.db (required for the server to serve data)
cd backend && npm run migrate

# Force re-scrape all sources even if cached data exists
cd python_scraper && python scrape_all.py --force

# Trigger a rescrape via the API (uses the Node.js scrapers, not Python)
curl -X POST http://localhost:3731/api/scrape
```

**Fresh checkout setup** (run in order):
```bash
cd python_scraper && python scrape_all.py   # populate results.json
cd backend && npm run migrate               # populate griskus.db from results.json
npm run dev                                 # server reads from griskus.db
```

Port configuration: `BACKEND_PORT` controls the Express server. The Vite dev server auto-picks a free port (`port: 0`, `strictPort: false`) and reads `BACKEND_PORT` to configure the `/api` proxy. Override with `BACKEND_PORT=4200 npm run dev`.

## Architecture

**Monorepo with three independent pieces:**

- `backend/` — Express REST API (ESM). Reads from `backend/data/griskus.db` (SQLite, WAL mode). Data is cached in-memory after first load; `invalidateCache()` clears it.
- `frontend/` — React + Vite + Tailwind SPA. No router library; routing is done manually via `window.location.search` query params and `history.pushState`.
- `python_scraper/` — The authoritative scraping tool. Writes to `backend/data/results.json`.

**Data flow:**
```
Python scraper → backend/data/results.json → (npm run migrate) → backend/data/griskus.db → Express API → React frontend
```
The Node.js scrapers (`backend/scrapers/`) write directly to the DB via `upsertBySource` and are triggered by `POST /api/scrape`. They cover fewer sources than the Python version.

**`backend/scripts/migrate.js`** — bridges the Python scraper and the SQLite DB. Reads `results.json`, upserts all records into `griskus.db`, then runs a cross-source merge pass to collapse duplicate rows (same athlete, same race, times within 2 seconds). Safe to re-run. Use `npm run migrate:wipe` to drop and recreate the table.

**Results record shape:**
```js
{ year, raceType, source, place, firstName, lastName, fullName, city, state,
  age, gender, division, divPlace, totalTime, swimTime, bikeTime, runTime, bib }
```
Times are strings in `H:MM:SS` or `MM:SS` format. The `useSort` hook in `frontend/src/hooks/useSort.js` handles numeric time parsing for sort comparisons.

**Frontend routing:** Three views — home, athlete (`?firstName=X&lastName=Y`), race (`?year=N&raceType=X`). `App.jsx` owns all routing state; `parseRoute()` reads params on load, `pushRoute()` writes them. Refreshing or direct-linking preserves the view.

**Key API endpoints:**
- `GET /api/results?year=&raceType=&limit=&offset=` — paginated, filterable
- `GET /api/summary` — per-race stats (count, best/avg/median time) grouped by year+raceType
- `GET /api/athletes/search?q=` — name autocomplete (min 2 chars, returns top 25)
- `GET /api/athletes/:lastName/:firstName` — all results for one athlete
- `POST /api/scrape` — triggers Node.js rescrape (non-blocking)

**Tailwind brand color:** `brand-*` maps to sky blue (`#0ea5e9` at 500). Defined in `frontend/tailwind.config.js`.

**Python scraper sources by year:**
- 1999–2005: plattsys (static HTML)
- 2006–2008: Wayback Machine (roadntracksports.com)
- 2009–2016, 2021: Athlinks API (Sprint only; 2021 Sprint has 135 finishers vs 67 on iResultsLive)
- 2009–2014: FastTrack (Wayback Machine, Olympic only)
- 2010–2016: USAT (Olympic/Duathlon — experimental)
- 2017–2022: iResultsLive AJAX API (2021 Sprint excluded — use Athlinks instead)
- 2023–2025: RunSignup REST API

Historical sources (plattsys, web_archive, athlinks, fasttrack) are cached — re-running the scraper skips them unless `--force` is passed. RunSignup always re-runs to pick up new race years.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
Font choices, color tokens, spacing, component patterns, and aesthetic direction are all defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.
