#!/usr/bin/env -S python3 -u
"""
USA Triathlon member portal scraper for Pat Griskus Olympic/Duathlon results.

Uses URL pagination: ?page=N with 25 athletes per page.
Results are in the server-rendered HTML (no JS needed).

Available events (year, event_id, race_id, race_type):
  2010 Olympic: events/1483/races/2105       (385 athletes)
  2011 Olympic: events/4146/races/6206       (475 athletes)
  2012 Olympic: events/4587/races/6964
  2013 Olympic: events/6482/races/10298
  2014 Olympic: events/8212/races/13529      (246 athletes)
  2014 Duathlon: events/8212/races/13531
  2016 Olympic: events/11833/races/20804     (182 athletes)
  2016 Duathlon: events/11833/races/20808
"""
import re
import math
import time
import requests

from .normalizer import make_result

BASE = 'https://member.usatriathlon.org'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; GriskusScraper/1.0)'}

EVENTS = [
    (2010, 1483, 2105,  'Olympic'),
    (2011, 4146, 6206,  'Olympic'),
    (2012, 4587, 6964,  'Olympic'),
    (2013, 6482, 10298, 'Olympic'),
    (2014, 8212, 13529, 'Olympic'),
    (2014, 8212, 13531, 'Duathlon'),
    (2016, 11833, 20804, 'Olympic'),
    (2016, 11833, 20808, 'Duathlon'),
]

PER_PAGE = 25


def parse_page(html):
    """Extract athlete rows from a results page."""
    blocks = re.findall(
        r'<a[^>]+href="https://member\.usatriathlon\.org/athletes/\d+/results"[^>]*>.*?</a>',
        html, re.DOTALL
    )
    rows = []
    for block in blocks:
        place_m = re.search(r'font-thin text-sm">\s*(\d+)(?:st|nd|rd|th)\s*<', block)
        last_m  = re.search(r'<span class="font-bold">([^<]+)</span>', block)
        first_m = re.search(r'</span>,\s*\n?\s*<span>\s*([^<]+?)\s*</span>', block)
        ag_m    = re.search(r'<span class="">\s*(\d+)([MF])\s*</span>', block)
        cs_m    = re.search(r'hidden sm:inline-block">\s*([^<]+?)\s*</span>', block)
        time_m  = re.search(r'(\d+:\d{2}:\d{2})(?:\.\d+)?', block)

        if not place_m or not last_m:
            continue

        age_gen = ag_m
        age     = int(ag_m.group(1)) if ag_m else None
        gender  = ag_m.group(2) if ag_m else ''

        city, state = '', ''
        if cs_m:
            cs = cs_m.group(1).strip()
            if ', ' in cs:
                parts = cs.rsplit(', ', 1)
                city, state = parts[0].strip(), parts[1].strip()
            else:
                state = cs

        rows.append({
            'place':     int(place_m.group(1)),
            'lastName':  last_m.group(1).strip(),
            'firstName': first_m.group(1).strip() if first_m else '',
            'age':       age,
            'gender':    gender,
            'city':      city,
            'state':     state,
            'time':      time_m.group(1) if time_m else '',
        })
    return rows


def get_with_retry(session, url, timeout=15):
    """GET with exponential backoff on 429."""
    for wait in (0, 10, 30, 60, 120):
        if wait:
            print(f'    Rate-limited, retrying in {wait}s...')
            time.sleep(wait)
        r = session.get(url, timeout=timeout)
        if r.status_code == 429:
            continue
        r.raise_for_status()
        return r
    raise Exception(f'Rate-limited on {url} after retries')


def fetch_race_results(year, event_id, race_id, race_type):
    url = f'{BASE}/events/{event_id}/races/{race_id}/results'
    session = requests.Session()
    session.headers.update(HEADERS)

    r = get_with_retry(session, url)
    html = r.text

    total_m = re.search(r'(\d+) Athletes', html)
    total = int(total_m.group(1)) if total_m else 0
    n_pages = math.ceil(total / PER_PAGE) if total else 1

    all_rows = parse_page(html)

    for page in range(2, n_pages + 1):
        time.sleep(2.0)
        r = get_with_retry(session, f'{url}?page={page}')
        all_rows.extend(parse_page(r.text))

    results = []
    for row in all_rows:
        results.append(make_result(
            year=year,
            race_type=race_type,
            source='usat',
            place=row['place'],
            first_name=row['firstName'],
            last_name=row['lastName'],
            city=row['city'],
            state=row['state'],
            age=row['age'],
            gender=row['gender'],
            total_time=row['time'],
        ))
    return results


def scrape_usat():
    print('Scraping USAT member portal (Olympic/Duathlon 2010–2016)...')
    all_results = []
    for year, event_id, race_id, race_type in EVENTS:
        try:
            rows = fetch_race_results(year, event_id, race_id, race_type)
            print(f'  {year} {race_type}: {len(rows)} results')
            all_results.extend(rows)
        except Exception as e:
            print(f'  {year} {race_type} FAILED: {e}')
        time.sleep(5.0)
    return all_results
