"""
RunSignUp / TriSignUp API scraper for 2023–2026+.
Race ID: 146252

Split fields changed format in 2026:
  2023–2025: custom-field-418879 (Swim), 418881 (T1), 418882 (Bike), 418884 (T2), 418885 (Run)
  2026+:     split-2295425 (Swim), 2295426 (T1), 2295427 (Bike), 2295428 (T2), 2295429 (Run)

Split fields are now discovered dynamically from results_headers so future year
format changes are handled automatically.
"""
import time
import requests
from .normalizer import make_result

BASE_URL = 'https://runsignup.com/Rest/race/146252/results/get-results'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; GriskusScraper/1.0)'}

EVENTS = [
    (2023, 'Olympic',   717239),
    (2023, 'Sprint',    717240),
    (2023, 'Duathlon',  717241),
    (2024, 'Olympic',   794611),
    (2024, 'Sprint',    794612),
    (2024, 'Duathlon',  794613),
    (2025, 'Olympic',   944968),
    (2025, 'Sprint',    944969),
    (2025, 'Duathlon',  944970),
    (2026, 'Olympic',   1096733),
    (2026, 'Sprint',    1096734),
    (2026, 'Duathlon',  1096735),
]

# Maps race type to the result set name pattern to pick the right set
RESULT_SET_KEYWORDS = {
    'Olympic': ['Olympic Tri Overall', 'Olympic Overall'],
    'Sprint':  ['Sprint Tri Overall', 'Sprint Overall'],
    'Duathlon': ['Duathlon Overall', 'Du Overall'],
}

def discover_split_fields(headers):
    """Map split label → field key by scanning results_headers.

    Handles label variations across years:
      2023: 'Swim Chip Time', 'Trans1 Chip Time', 'Bike Chip Time', 'Trans2 Chip Time', 'Run Chip Time'
      2024-2025: 'Swim ', 'T1', 'Bike ', 'T2', 'Run '
      2026+: 'Swim', 'T1', 'Bike', 'T2', 'Run'
    """
    splits = {}
    # Each entry: (split_name, prefixes_that_match_the_label)
    patterns = [
        ('swim', ('swim',)),
        ('t1',   ('t1', 'trans1')),
        ('bike', ('bike', 'cycle')),
        ('t2',   ('t2', 'trans2')),
        ('run',  ('run',)),
    ]
    for field_key, label in headers.items():
        label_lower = label.strip().lower()
        for split_name, prefixes in patterns:
            if split_name in splits:
                continue
            if any(label_lower == p or label_lower.startswith(p + ' ') for p in prefixes):
                splits[split_name] = field_key
    return splits

# Find the right result set for a race type
def pick_result_set(result_sets, race_type):
    keywords = RESULT_SET_KEYWORDS.get(race_type, [])
    for rs in result_sets:
        name = rs.get('individual_result_set_name', '').lower()
        if any(k.lower() in name for k in keywords):
            return rs
    # Fallback: just use first set with results
    for rs in result_sets:
        if rs.get('results'):
            return rs
    return None


def fetch_event_results(year, race_type, event_id):
    all_rows = []
    page = 1
    per_page = 500

    while True:
        params = {
            'format': 'json',
            'event_id': event_id,
            'results_per_page': per_page,
            'page': page,
        }
        try:
            r = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f'    API error (page {page}): {e}')
            break

        result_sets = data.get('individual_results_sets', [])
        rs = pick_result_set(result_sets, race_type)
        if not rs:
            # Try first non-empty set
            rs = next((s for s in result_sets if s.get('results')), None)
        if not rs:
            break

        rows = rs.get('results', [])
        if not rows:
            break

        result_headers = rs.get('results_headers', {})
        split_fields = discover_split_fields(result_headers)

        for row in rows:
            # Find division from placement columns
            division = ''
            div_place = None
            for key, val in row.items():
                if key.startswith('division-') and key.endswith('-placement') and val:
                    div_name = result_headers.get(key, '')
                    if div_name and val:
                        division = div_name
                        div_place = val
                        break

            all_rows.append(make_result(
                year=year, race_type=race_type, source='runsignup',
                place=row.get('place'),
                first_name=row.get('first_name', ''),
                last_name=row.get('last_name', ''),
                city=row.get('city', ''),
                state=row.get('state', ''),
                age=row.get('age'),
                gender=row.get('gender', ''),
                division=division,
                div_place=div_place,
                total_time=row.get('chip_time', '') or row.get('clock_time', ''),
                swim_time=row.get(split_fields.get('swim', ''), ''),
                bike_time=row.get(split_fields.get('bike', ''), ''),
                run_time=row.get(split_fields.get('run', ''), ''),
                bib=row.get('bib', ''),
            ))

        # Check if there are more pages
        total = rs.get('total_results')
        if total and len(all_rows) >= int(total):
            break
        if len(rows) < per_page:
            break
        page += 1
        time.sleep(0.3)

    return all_rows


def scrape_runsignup():
    print('Scraping RunSignUp API (2023–2026)...')
    all_results = []
    for year, race_type, event_id in EVENTS:
        try:
            rows = fetch_event_results(year, race_type, event_id)
            print(f'  {year} {race_type}: {len(rows)} results')
            all_results.extend(rows)
        except Exception as e:
            print(f'  {year} {race_type} FAILED: {e}')
        time.sleep(0.5)
    return all_results
