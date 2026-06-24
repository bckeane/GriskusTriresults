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

# Trigger a rescrape via the API (uses the Node.js scrapers, not Python)
curl -X POST http://localhost:3731/api/scrape
```

Port configuration: `BACKEND_PORT` controls the Express server. The Vite dev server auto-picks a free port (`port: 0`, `strictPort: false`) and reads `BACKEND_PORT` to configure the `/api` proxy. Override with `BACKEND_PORT=4200 npm run dev`.

## Architecture

**Monorepo with three independent pieces:**

- `backend/` — Express REST API (ESM). Serves `results.json` through several endpoints. Data is cached in-memory after first load; `invalidateCache()` clears it.
- `frontend/` — React + Vite + Tailwind SPA. No router library; routing is done manually via `window.location.search` query params and `history.pushState`.
- `python_scraper/` — The authoritative scraping tool. Writes directly to `backend/data/results.json`.

**Data flow:** Python scraper → `backend/data/results.json` → Express API → React frontend. The Node.js scrapers (`backend/scrapers/`) cover the same sources but are less complete than the Python version.

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
- 2009–2016: Athlinks API (Sprint only — Olympic/Duathlon data for these years is not available)
- 2017–2022: iResultsLive AJAX API
- 2023–2025: RunSignup REST API

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
