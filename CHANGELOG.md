# Changelog

All notable changes to Griskus are documented here.

## [1.1.1] - 2026-06-29

### Performance
- API responses now include `Cache-Control: public, max-age=3600` headers on all read endpoints (`/api/results`, `/api/summary`, `/api/demographics`, `/api/athletes/search`, `/api/athletes/:lastName/:firstName`). Repeat visits and tab-restores serve from browser cache with zero server round-trips for up to an hour.
- Demographics aggregation (`getDemographics`) is now memoized in process memory. Previously re-queried and re-aggregated SQLite on every request; now computed once per server lifecycle and cleared on scrape.

## [1.1.0] - 2026-06-27

### Added
- Full design system overhaul: dark header, copper/amber PB nameplate, Barlow Condensed display font, DM Sans body font
- TriScore: composite performance score (place + pace percentile) displayed on athlete profiles
- Demographics dashboard: gender splits and age group participation trends per race year
- Timeline chart: athlete performance history across all race years
- Athlete identity panel: personal bests, career stats, division rank
- YourResultsCard: pin your name to the homepage for quick access to your results
- Lazy-loaded views and parallel API fetches for faster initial page load
- Self-hosted fonts (Barlow Condensed, DM Sans) — no external CDN requests
- Support for `/griskus` subpath deployment on ctkeane.com

### Fixed
- 2020 results excluded from all views (race was cancelled/virtual)
- API calls resolve correctly under `/griskus` subpath prefix
- Deploy script always rebuilds dist with correct env vars before pushing
