#!/usr/bin/env python3
"""
Main orchestrator for Pat Griskus Triathlon result scraping.
Combines data from all sources and writes to the Node.js backend data file.

Sources:
  plattsys     1999–2005  (static HTML, pre-block fixed-width text)
  web_archive  2006–2008  (Wayback Machine, roadntracksports.com pages)
  athlinks     2009–2016  (Athlinks results API, Sprint only)
  iresultslive 2017–2022  (iResultsLive AJAX API)
  runsignup    2023–2025  (REST API)

Gap: 2009–2016 Olympic/Duathlon — not found on any available source.
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
from scrapers.runsignup import scrape_runsignup
from scrapers.iresultslive import scrape_iresultslive


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


def run_scraper(name, fn):
    print(f'\n{"="*50}')
    try:
        results = fn()
        print(f'  → {name}: {len(results)} records collected')
        return results
    except Exception as e:
        print(f'  → {name} FAILED: {e}')
        import traceback
        traceback.print_exc()
        return []


def main():
    skip = set(sys.argv[1:])  # e.g., python scrape_all.py iresultslive

    all_results = []

    if 'plattsys' not in skip:
        all_results.extend(run_scraper('PlatSys (1999–2005)', scrape_plattsys))

    if 'web_archive' not in skip:
        all_results.extend(run_scraper('Wayback Machine (2006–2008)', scrape_web_archive))

    if 'athlinks' not in skip:
        all_results.extend(run_scraper('Athlinks (2009–2016 Sprint)', scrape_athlinks))

    if 'iresultslive' not in skip:
        all_results.extend(run_scraper('iResultsLive (2017–2022)', scrape_iresultslive))

    if 'runsignup' not in skip:
        all_results.extend(run_scraper('RunSignUp (2023–2025)', scrape_runsignup))

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
