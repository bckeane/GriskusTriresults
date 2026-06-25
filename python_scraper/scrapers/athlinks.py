"""
Athlinks scraper for Pat Griskus Sprint Triathlon results, 2009–2016.

Uses the results.athlinks.com JSON API (no Playwright needed).
Series master ID: 30740 (Pat Griskus Sprint Triathalon)

The API returns OVERALL, GENDER, and DIVISION bracket groups.
We pick OVERALL, skip relay courses, and paginate via `from` offset.

Splits are fetched via the individual endpoint after collecting list results:
  GET /individual?eventId={eid}&eventCourseId={ecid}&bib={bib}&id=0
  Returns intervals[]: Swim, Transition, Bike/Cycle, Transition, Run, Full Course

Splits are cached in python_scraper/cache/athlinks_splits.json so subsequent
runs skip already-fetched athletes entirely.
"""
import json
import socket
import time
import requests
from pathlib import Path

socket.setdefaulttimeout(8)  # hard OS-level cap on all socket operations
from .normalizer import make_result

SPLITS_CACHE_FILE = Path(__file__).parent.parent / 'cache' / 'athlinks_splits.json'

BASE_URL = 'https://results.athlinks.com/event/{event_id}'
INDIVIDUAL_URL = 'https://results.athlinks.com/individual'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; GriskusScraper/1.0)',
    'Origin': 'https://www.athlinks.com',
    'Referer': 'https://www.athlinks.com/',
}

# Sprint-only events for the 2009–2016 gap years.
# (year, event_id, event_course_id)
# eventCourseId was discovered empirically — it differs from the alaska.athlinks.com CourseID.
EVENTS = [
    (2009, 96281,  134492),
    (2010, 131426, 179512),
    (2011, 171461, 235519),
    (2012, 206807, 285669),
    (2013, 252801, 430755),
    (2014, 358923, 579757),
    (2015, 460001, 686063),
    (2016, 567372, 847426),
]

# Keywords that indicate a relay course — skip these
RELAY_KEYWORDS = ('relay', 'team')


def ms_to_time(ms):
    """Convert milliseconds to H:MM:SS or M:SS string."""
    total_s = int(ms) // 1000
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    if h:
        return f'{h}:{m:02d}:{s:02d}'
    return f'{m}:{s:02d}'


def state_from_region_id(region_id):
    """Extract state abbreviation from regionId like 'US_CT' or 'US-CT'."""
    if not region_id:
        return ''
    parts = region_id.replace('-', '_').split('_')
    return parts[-1].upper() if len(parts) >= 2 else ''


def is_relay_course(name):
    name_lower = (name or '').lower()
    return any(kw in name_lower for kw in RELAY_KEYWORDS)


def pick_main_bracket(brackets):
    """Return the OVERALL bracket for the main (non-relay) Sprint course."""
    overall_brackets = [b for b in brackets if b.get('bracketType') == 'OVERALL']
    # Prefer non-relay, then pick the one with the most athletes
    non_relay = [b for b in overall_brackets if not is_relay_course(b.get('eventCourseName', ''))]
    candidates = non_relay if non_relay else overall_brackets
    if not candidates:
        return None
    return max(candidates, key=lambda b: b.get('totalAthletes', 0))


def load_splits_cache():
    if SPLITS_CACHE_FILE.exists():
        with open(SPLITS_CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_splits_cache(cache):
    SPLITS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SPLITS_CACHE_FILE, 'w') as f:
        json.dump(cache, f)


def splits_cache_key(event_id, event_course_id, bib):
    return f'{event_id}_{event_course_id}_{bib}'


def fetch_splits(event_id, event_course_id, bib):
    """Fetch swim/bike/run splits for one athlete via the individual endpoint.

    Returns dict with keys: swim, bike, run (time strings, or '' if unavailable).
    Transitions are not stored in our schema so they're discarded.
    """
    if not bib:
        return {}
    params = {
        'eventId': event_id,
        'eventCourseId': event_course_id,
        'bib': bib,
        'id': 0,
    }
    try:
        r = requests.get(INDIVIDUAL_URL, params=params, headers=HEADERS, timeout=(5, 8))
        r.raise_for_status()
        data = r.json()
    except Exception:
        return {}

    intervals = data.get('intervals', []) if isinstance(data, dict) else []
    if not intervals:
        # data is sometimes a list of athlete objects
        if isinstance(data, list) and data:
            intervals = data[0].get('intervals', [])

    splits = {}
    transition_count = 0
    for iv in intervals:
        name = (iv.get('intervalName') or '').strip().lower()
        ms = (iv.get('chipTime') or {}).get('timeInMillis', 0)
        t = ms_to_time(ms) if ms else ''
        if name == 'swim':
            splits['swim'] = t
        elif name in ('bike', 'cycle', 'bike/cycle'):
            splits['bike'] = t
        elif name == 'run':
            splits['run'] = t
        elif name == 'transition':
            transition_count += 1
            # first transition = T1, second = T2 (not stored, schema has no t1/t2)
    return splits


def fetch_event_results(year, event_id, event_course_id, splits_cache, skip_splits=False):
    url = BASE_URL.format(event_id=event_id)
    all_rows = []
    total = None
    from_idx = 0

    while True:
        params = {
            'eventCourseId': event_course_id,
            'divisionId': '',
            'intervalId': '',
            'from': from_idx,
            'limit': 100,
        }
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=15)
            r.raise_for_status()
            brackets = r.json()
        except Exception as e:
            print(f'    API error at from={from_idx}: {e}')
            break

        bracket = pick_main_bracket(brackets)
        if not bracket:
            # Retry up to 3 times with increasing backoff — API rate-limits intermittently
            for wait in (5, 15, 30):
                print(f'    Rate-limited at from={from_idx}, retrying in {wait}s...')
                time.sleep(wait)
                try:
                    r = requests.get(url, params=params, headers=HEADERS, timeout=15)
                    r.raise_for_status()
                    brackets = r.json()
                except Exception:
                    continue
                bracket = pick_main_bracket(brackets)
                if bracket:
                    break
            if not bracket:
                print(f'    Gave up at from={from_idx} after retries')
                break

        if total is None:
            total = bracket.get('totalAthletes', 0)

        results = bracket.get('interval', {}).get('intervalResults', [])
        if not results:
            break

        for rec in results:
            ms = rec.get('time', {}).get('timeInMillis', 0)
            total_time = ms_to_time(ms) if ms else ''

            region_id = rec.get('regionId', '')
            state = state_from_region_id(region_id)

            div_place = rec.get('primaryBracketRank')

            all_rows.append({
                '_meta': {'event_id': event_id, 'ecid': event_course_id, 'bib': rec.get('bib', '')},
                'row': make_result(
                    year=year,
                    race_type='Sprint',
                    source='athlinks',
                    place=rec.get('overallRank'),
                    first_name=rec.get('firstName', ''),
                    last_name=rec.get('lastName', ''),
                    city=rec.get('locality', ''),
                    state=state,
                    age=rec.get('age'),
                    gender=rec.get('gender', ''),
                    division='',
                    div_place=div_place,
                    total_time=total_time,
                    bib=rec.get('bib', ''),
                ),
            })

        from_idx += len(results)
        if len(results) < 100:  # partial page = end of results
            break
        if total and from_idx >= total:
            break
        time.sleep(2.0)

    # Enrich with individual splits, using cache to skip already-fetched athletes
    if not skip_splits:
        need_fetch = [(i, e) for i, e in enumerate(all_rows)
                      if splits_cache_key(e['_meta']['event_id'], e['_meta']['ecid'], e['_meta']['bib']) not in splits_cache]
        cached_count = len(all_rows) - len(need_fetch)
        if cached_count:
            print(f'    {cached_count}/{len(all_rows)} splits from cache, fetching {len(need_fetch)} new...')
        else:
            print(f'    Fetching splits for {len(all_rows)} athletes...')

        for i, (orig_idx, entry) in enumerate(need_fetch):
            meta = entry['_meta']
            key = splits_cache_key(meta['event_id'], meta['ecid'], meta['bib'])
            splits = fetch_splits(meta['event_id'], meta['ecid'], meta['bib'])
            if splits:  # only cache successful fetches; empty = timeout/error, retry next run
                splits_cache[key] = splits
            if (i + 1) % 50 == 0:
                print(f'      {i + 1}/{len(need_fetch)} splits fetched')
                save_splits_cache(splits_cache)
            time.sleep(0.15)

        if need_fetch:
            save_splits_cache(splits_cache)

    enriched = []
    for entry in all_rows:
        meta = entry['_meta']
        row = entry['row']
        key = splits_cache_key(meta['event_id'], meta['ecid'], meta['bib'])
        splits = splits_cache.get(key, {})
        if splits:
            row = dict(row)
            if splits.get('swim'):
                row['swimTime'] = splits['swim']
            if splits.get('bike'):
                row['bikeTime'] = splits['bike']
            if splits.get('run'):
                row['runTime'] = splits['run']
        enriched.append(row)

    return enriched


def scrape_athlinks(skip_splits=False):
    print('Scraping Athlinks API (2009–2016 Sprint)...')
    splits_cache = load_splits_cache()
    if splits_cache:
        print(f'  Loaded {len(splits_cache)} cached splits')
    if skip_splits:
        print('  (split fetching disabled — using cache only)')
    all_results = []
    for year, event_id, event_course_id in EVENTS:
        try:
            rows = fetch_event_results(year, event_id, event_course_id, splits_cache, skip_splits=skip_splits)
            print(f'  {year} Sprint: {len(rows)} results')
            all_results.extend(rows)
        except Exception as e:
            print(f'  {year} Sprint FAILED: {e}')
        time.sleep(2.0)
    return all_results
