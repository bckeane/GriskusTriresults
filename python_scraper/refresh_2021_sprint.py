"""
Targeted refresh: replace 2021 Sprint results in results.json with Athlinks data.

Athlinks has 135 finishers (event 977935, course 2091993) vs iResultsLive's 67.
Removes existing iresultslive 2021 Sprint records, fetches fresh from Athlinks,
then splices them in and writes results.json.

Run from python_scraper/:
    python3 refresh_2021_sprint.py
"""
import json
import sys
from pathlib import Path

RESULTS_FILE = Path(__file__).parent.parent / 'backend' / 'data' / 'results.json'
ATHLINKS_EVENT_ID = 977935
ATHLINKS_COURSE_ID = 2091993

sys.path.insert(0, str(Path(__file__).parent))
from scrapers.athlinks import fetch_event_results, load_splits_cache, save_splits_cache

def main():
    print(f'Loading {RESULTS_FILE}...')
    with open(RESULTS_FILE) as f:
        all_results = json.load(f)

    before = len(all_results)
    old_sprint = [r for r in all_results if r.get('year') == 2021 and r.get('raceType') == 'Sprint']
    print(f'  Found {len(old_sprint)} existing 2021 Sprint records (source: {set(r.get("source") for r in old_sprint)})')

    # Remove old 2021 Sprint records
    all_results = [r for r in all_results if not (r.get('year') == 2021 and r.get('raceType') == 'Sprint')]
    print(f'  Removed {before - len(all_results)} records')

    # Fetch fresh from Athlinks (with splits)
    print(f'\nFetching 2021 Sprint from Athlinks (event={ATHLINKS_EVENT_ID}, course={ATHLINKS_COURSE_ID})...')
    splits_cache = load_splits_cache()
    new_rows = fetch_event_results(2021, ATHLINKS_EVENT_ID, ATHLINKS_COURSE_ID, splits_cache)
    save_splits_cache(splits_cache)
    print(f'  Got {len(new_rows)} results')

    if not new_rows:
        print('ERROR: No results returned — aborting, results.json unchanged')
        sys.exit(1)

    all_results.extend(new_rows)
    print(f'\nWriting {len(all_results)} total records to {RESULTS_FILE}...')
    with open(RESULTS_FILE, 'w') as f:
        json.dump(all_results, f)

    print('Done. Run `cd backend && npm run migrate` to update the database.')

if __name__ == '__main__':
    main()
