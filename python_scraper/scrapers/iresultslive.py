"""
iResultsLive scraper using the internal AJAX JSON API.

The site renders results via /ajax/ajaxGetResults.php, which accepts:
  eventId, raceName, divName, gender, maxResults, startingPlace

This is much simpler and more complete than Playwright scraping.

Events and race names discovered by checking ?eid=XXXX event summary pages
and testing each race name against the AJAX endpoint.

Gap: 2018 Olympic not found on iResultsLive (not in known event IDs).
     2021 Olympic/Duathlon not available (COVID-limited event).
"""
import time
import requests
from .normalizer import make_result

BASE = 'https://www.iresultslive.com/ajax/ajaxGetResults.php'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; GriskusScraper/1.0)'}

# (year, eid, [(race_type_label, api_race_name), ...])
EVENTS = [
    (2017, 2725, [('Olympic', 'OLYTRI'), ('Sprint', 'SPRINTTRI'), ('Duathlon', 'DU')]),
    (2018, 3527, [('Sprint', 'SPRINT'), ('Duathlon', 'DUATHLON')]),
    (2019, 4270, [('Olympic', 'OLY'), ('Sprint', 'SPRINT'), ('Duathlon', 'OLYDUATHLON')]),
    (2021, 5002, [('Sprint', 'SPRINTTRI')]),
    (2022, 5295, [('Olympic', 'OLY'), ('Sprint', 'SPRINT'), ('Duathlon', 'DUATHLON')]),
]


def clean_time(t):
    """Normalize time strings like 02:05:12 -> 2:05:12."""
    if not t:
        return ''
    t = str(t).strip()
    import re
    t = re.sub(r'^0(\d:\d{2}:\d{2})$', r'\1', t)
    return t


def fetch_race_results(year, eid, race_type, race_name):
    all_rows = []
    page = 1
    per_page = 500

    while True:
        params = {
            'eventId': eid,
            'raceName': race_name,
            'divName': 'overall',
            'gender': 'all',
            'maxResults': per_page,
            'startingPlace': (page - 1) * per_page + 1,
        }
        try:
            r = requests.get(BASE, params=params, headers=HEADERS, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f'    API error page {page}: {e}')
            break

        if not data:
            break

        for rec in data:
            if not rec.get('first_name') or not rec.get('last_name'):
                continue
            place = rec.get('overall_place')
            if not place:
                continue

            all_rows.append(make_result(
                year=year, race_type=race_type, source='iresultslive',
                place=place,
                first_name=rec.get('first_name', ''),
                last_name=rec.get('last_name', ''),
                city=rec.get('city', ''),
                state=rec.get('state', ''),
                age=rec.get('age'),
                gender=rec.get('sex', ''),
                division=rec.get('division', ''),
                div_place=rec.get('div_place'),
                total_time=clean_time(rec.get('gun_time', '') or rec.get('net_time', '')),
                swim_time=clean_time(rec.get('swim_time', '')),
                bike_time=clean_time(rec.get('bike_time', '')),
                run_time=clean_time(rec.get('run_time', '')),
                bib=rec.get('bib', ''),
            ))

        if len(data) < per_page:
            break
        page += 1
        time.sleep(0.2)

    return all_rows


def scrape_iresultslive():
    print('Scraping iResultsLive API (2017–2022)...')
    all_results = []
    for year, eid, races in EVENTS:
        for race_type, race_name in races:
            try:
                rows = fetch_race_results(year, eid, race_type, race_name)
                print(f'  {year} {race_type}: {len(rows)} results')
                all_results.extend(rows)
            except Exception as e:
                print(f'  {year} {race_type} FAILED: {e}')
            time.sleep(0.3)
    return all_results
