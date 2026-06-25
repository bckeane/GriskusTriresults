#!/usr/bin/env -S python3 -u
"""
Main orchestrator for Pat Griskus Triathlon result scraping.
Combines data from all sources and writes to the Node.js backend data file.

Sources:
  plattsys     1999–2005  (static HTML, pre-block fixed-width text)
  web_archive  2006–2008  (Wayback Machine, roadntracksports.com pages)
  athlinks     2009–2016  (Athlinks results API, Sprint only)
  fasttrack    2009–2014  (Wayback Machine, fasttrackcoaching.net, Olympic only)
  iresultslive 2017–2022  (iResultsLive AJAX API)
  runsignup    2023–2025  (REST API)

Gap: 2010 Olympic — never archived on Wayback Machine.
"""
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

# Path to write the combined output
BACKEND_DATA = Path(__file__).parent.parent / 'backend' / 'data' / 'results.json'

sys.path.insert(0, str(Path(__file__).parent))

from scrapers.plattsys import scrape_plattsys
from scrapers.web_archive import scrape_web_archive
from scrapers.athlinks import scrape_athlinks
from scrapers.fasttrack import scrape_fasttrack
from scrapers.runsignup import scrape_runsignup
from scrapers.iresultslive import scrape_iresultslive
from scrapers.usat import scrape_usat


def dedup_key(r):
    """Deduplication key: year + raceType + fullName + totalTime."""
    return (
        r.get('year'),
        r.get('raceType', '').lower(),
        r.get('fullName', '').lower().strip(),
        r.get('totalTime', ''),
    )


def merge_results(all_results):
    """Deduplicate results, preferring records with more data."""
    seen = {}
    for r in all_results:
        k = dedup_key(r)
        if k not in seen:
            seen[k] = r
        else:
            # Prefer the record with more non-empty fields
            existing = seen[k]
            if sum(1 for v in r.values() if v) > sum(1 for v in existing.values() if v):
                seen[k] = r
    return list(seen.values())


def print_summary(results):
    by_year = defaultdict(lambda: defaultdict(int))
    for r in results:
        by_year[r['year']][r['raceType']] += 1

    print('\n=== Final Results Summary ===')
    total = 0
    for year in sorted(by_year):
        for race_type, count in sorted(by_year[year].items()):
            print(f'  {year} {race_type}: {count}')
            total += count
    print(f'\nTotal records: {total}')


def load_existing_by_source():
    """Load existing results.json grouped by source key. Called once at startup."""
    if not BACKEND_DATA.exists():
        return {}
    with open(BACKEND_DATA) as f:
        data = json.load(f)
    by_source = defaultdict(list)
    for r in data:
        by_source[r.get('source', '')].append(r)
    return dict(by_source)


def run_scraper(name, fn, existing_by_source, source_key=None, always_run=False):
    """Run a scraper with optional skip-if-data and fallback logic.

    If always_run=False (default) and existing data exists for source_key,
    skip the network call entirely and return existing records. This avoids
    re-hitting rate-limited APIs for historical data that never changes.
    Pass always_run=True for sources that grow over time (e.g. RunSignUp).
    """
    print(f'\n{"="*50}')
    if not always_run and source_key:
        existing = existing_by_source.get(source_key, [])
        if existing:
            print(f'Skipping {name} — already have {len(existing)} records (pass --force to re-scrape)')
            return existing
    try:
        results = fn()
        print(f'  → {name}: {len(results)} records collected')
        if not results and source_key:
            fallback = existing_by_source.get(source_key, [])
            if fallback:
                print(f'  → {name} returned 0 — keeping {len(fallback)} existing records')
                return fallback
        return results
    except Exception as e:
        print(f'  → {name} FAILED: {e}')
        import traceback
        traceback.print_exc()
        if source_key:
            fallback = existing_by_source.get(source_key, [])
            if fallback:
                print(f'  → Keeping {len(fallback)} existing records from {source_key}')
                return fallback
        return []


def main():
    args = sys.argv[1:]
    force = '--force' in args
    skip = set(a for a in args if not a.startswith('--'))  # e.g. web_archive fasttrack

    # Snapshot existing data before any scraper runs, so fallbacks are stable
    # even if results.json gets wiped partway through.
    existing = load_existing_by_source()
    if existing:
        total_existing = sum(len(v) for v in existing.values())
        print(f'Loaded {total_existing} existing records as fallback snapshot')

    all_results = []

    if 'plattsys' not in skip:
        all_results.extend(run_scraper('PlatSys (1999–2005)', scrape_plattsys, existing, 'plattsys', always_run=force))

    if 'web_archive' not in skip:
        all_results.extend(run_scraper('Wayback Machine (2006–2008)', scrape_web_archive, existing, 'web_archive', always_run=force))

    if 'athlinks' not in skip:
        all_results.extend(run_scraper('Athlinks (2009–2016 Sprint)', lambda: scrape_athlinks(skip_splits=True), existing, 'athlinks', always_run=force))

    if 'fasttrack' not in skip:
        all_results.extend(run_scraper('FastTrack (2009–2014 Olympic)', scrape_fasttrack, existing, 'fasttrack', always_run=force))

    if 'iresultslive' not in skip:
        all_results.extend(run_scraper('iResultsLive (2017–2022)', scrape_iresultslive, existing, 'iresultslive', always_run=force))

    if 'usat' not in skip:
        all_results.extend(run_scraper('USAT (Olympic/Duathlon 2010–2016)', scrape_usat, existing, 'usat', always_run=force))

    if 'runsignup' not in skip:
        # always_run=True: picks up new years (2026, etc.) as they're added
        all_results.extend(run_scraper('RunSignUp (2023+)', scrape_runsignup, existing, 'runsignup', always_run=True))

    print(f'\nMerging {len(all_results)} total records...')
    merged = merge_results(all_results)
    merged.sort(key=lambda r: (r['year'], r['raceType'], r.get('place') or 9999))

    print_summary(merged)

    BACKEND_DATA.parent.mkdir(parents=True, exist_ok=True)
    with open(BACKEND_DATA, 'w') as f:
        json.dump(merged, f, indent=2)
    print(f'\nWrote {len(merged)} records to {BACKEND_DATA}')


if __name__ == '__main__':
    main()
