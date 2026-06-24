"""
Scraper for PlatSys static HTML pages (1999–2005).
Handles three fixed-width pre-block formats:
  - 1999-2001: ---- separator, Rank/Time/Nmbr/Name/Division columns
  - 2002-2005 columnar: LAST/FIRST/CITY/STATE/Division token-based
  - 2003-2004 Olympic: ===== separator, Place/Name/City/ST/Age/S/splits
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from .normalizer import make_result

RACES = [
    (1999, 'Sprint', 'http://www.plattsys.com/results/res1999/grisk99.htm'),
    (2000, 'Sprint', 'http://www.plattsys.com/results/res2000/gris00.htm'),
    (2001, 'Sprint', 'http://www.plattsys.com/results/res2001/gris01.htm'),
    (2002, 'Olympic', 'http://www.plattsys.com/results/res2002/griso02.htm'),
    (2002, 'Sprint', 'http://www.plattsys.com/results/res2002/griskus02.htm'),
    (2003, 'Olympic', 'http://www.plattsys.com/results/res2003/griso03.htm'),
    (2003, 'Sprint', 'http://www.plattsys.com/results/res2003/gris03.htm'),
    (2004, 'Olympic', 'http://www.plattsys.com/results/res2004/griso04.htm'),
    (2004, 'Sprint', 'http://www.plattsys.com/results/res2004/griss04.htm'),
    (2005, 'Olympic', 'http://www.plattsys.com/results/res2005/griso05.htm'),
    (2005, 'Sprint', 'http://www.plattsys.com/results/res2005/griss05.htm'),
]

HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; GriskusScraper/1.0)'}


def col_ranges(sep_line):
    ranges, in_block, start = [], False, 0
    for i, ch in enumerate(sep_line):
        if ch in '-=':
            if not in_block:
                in_block, start = True, i
        else:
            if in_block:
                ranges.append((start, i))
                in_block = False
    if in_block:
        ranges.append((start, len(sep_line)))
    return ranges


def slice_cols(line, ranges):
    return [line[s:e].strip() for s, e in ranges]


def parse_1999(text, year, race_type):
    lines = text.split('\n')
    sep_idx = next((i for i, l in enumerate(lines) if re.match(r'^-{4,}', l.strip())), -1)
    if sep_idx == -1:
        return []
    ranges = col_ranges(lines[sep_idx])
    if len(ranges) < 7:
        return []
    results = []
    for line in lines[sep_idx + 1:]:
        if not line.strip() or line.strip().startswith('-'):
            continue
        cols = slice_cols(line, ranges)
        place = int(cols[0]) if cols[0].isdigit() else None
        if not place:
            continue
        full_name = cols[3].strip()
        division = cols[4].strip() if len(cols) > 4 else ''
        if not full_name or 'TEAM' in division.upper():
            continue
        parts = full_name.split()
        first, last = parts[0], ' '.join(parts[1:])
        if not last:
            continue
        gm = re.search(r'\b([MF])\b|\b(MALE|FEMALE)\b', division, re.I)
        gender = ''
        if gm:
            raw = (gm.group(1) or gm.group(2) or '').upper()
            gender = 'F' if raw.startswith('F') else 'M'
        results.append(make_result(
            year=year, race_type=race_type, source='plattsys',
            place=place, first_name=first, last_name=last,
            gender=gender, division=division,
            total_time=cols[1] if len(cols) > 1 else '',
            swim_time=cols[6] if len(cols) > 6 else '',
            bike_time=cols[7] if len(cols) > 7 else '',
            run_time=cols[8] if len(cols) > 8 else '',
            bib=cols[2] if len(cols) > 2 else '',
        ))
    return results


def parse_equals(text, year, race_type):
    """2003-2004 Olympic: ===== separator."""
    lines = text.split('\n')
    sep_idx = next((i for i, l in enumerate(lines) if re.search(r'={5,}', l)), -1)
    if sep_idx == -1:
        return []
    ranges = col_ranges(lines[sep_idx])
    if len(ranges) < 8:
        return []
    results = []
    for line in lines[sep_idx + 1:]:
        if not line.strip() or re.match(r'^=', line.strip()):
            continue
        cols = slice_cols(line, ranges)
        place = int(cols[0]) if cols[0].isdigit() else None
        if not place:
            continue
        full_name = cols[1].strip()
        if not full_name:
            continue
        parts = full_name.split()
        first, last = parts[0], ' '.join(parts[1:])
        age_str = cols[4] if len(cols) > 4 else ''
        results.append(make_result(
            year=year, race_type=race_type, source='plattsys',
            place=place, first_name=first, last_name=last,
            city=cols[2] if len(cols) > 2 else '',
            state=cols[3] if len(cols) > 3 else '',
            age=int(age_str) if age_str.isdigit() else None,
            gender=cols[5] if len(cols) > 5 else '',
            total_time=cols[9] if len(cols) > 9 else (cols[8] if len(cols) > 8 else ''),
            swim_time=cols[6] if len(cols) > 6 else '',
            bike_time=cols[7] if len(cols) > 7 else '',
            run_time=cols[8] if len(cols) > 8 else '',
        ))
    return results


IS_TIME = re.compile(r'^\d{1,2}:\d{2}(:\d{2})?$')
IS_LONG = re.compile(r'^\d:\d{2}:\d{2}$')
IS_SHORT_NUM = re.compile(r'^\d{1,3}$')
IS_DIV = re.compile(r'^[MF]\d{4}$', re.I)
IS_AGE_G = re.compile(r'^\d{2}[MF]$', re.I)
IS_STATE = re.compile(r'^[A-Z]{2}$')


def parse_columnar_line(line):
    tokens = line.split()
    if len(tokens) < 8:
        return None
    i = 0
    try:
        place = int(tokens[i])
    except ValueError:
        return None
    if place <= 0 or place > 5000:
        return None
    i += 1
    if not tokens[i][0].isupper():
        return None
    last = tokens[i]; i += 1
    first = tokens[i]; i += 1
    if i < len(tokens) and re.match(r'^[A-Z]\.$', tokens[i]):
        first += ' ' + tokens[i]; i += 1

    times, city_tokens = [], []
    state, age_gender, division, div_place, bib = '', '', '', None, ''
    found_state = found_div = found_dp = False

    while i < len(tokens):
        t = tokens[i]; i += 1
        if IS_TIME.match(t):
            times.append(t)
        elif IS_DIV.match(t) and not found_div:
            division = t.upper(); found_div = True
        elif IS_AGE_G.match(t) and not age_gender:
            age_gender = t.upper()
        elif IS_STATE.match(t) and not found_state and city_tokens:
            state = t; found_state = True
        elif found_div and not found_dp and IS_SHORT_NUM.match(t):
            div_place = int(t); found_dp = True
        elif len(times) >= 3 and IS_SHORT_NUM.match(t):
            bib = t
        elif IS_SHORT_NUM.match(t):
            pass  # rank marker between splits
        elif not found_state:
            city_tokens.append(t)

    # Assign times: first H:MM:SS = total; swim = next; bike = first H:MM:SS after swim; run = last
    total = swim = bike = run = ''
    long_idxs = [j for j, t in enumerate(times) if IS_LONG.match(t)]
    if long_idxs:
        total = times[long_idxs[0]]
        after = times[long_idxs[0] + 1:]
        swim = after[0] if after else ''
        bike_idxs = [j for j, t in enumerate(after) if IS_LONG.match(t)]
        if bike_idxs:
            bike = after[bike_idxs[0]]
            remaining = [t for t in after[bike_idxs[0] + 1:] if IS_TIME.match(t)]
            run = remaining[-1] if remaining else ''
        elif len(after) > 1:
            run = after[-1]

    m = re.match(r'(\d{2})([MF])', age_gender, re.I)
    age = int(m.group(1)) if m else None
    gender = m.group(2).upper() if m else (division[0].upper() if division else '')

    return make_result(
        year=0, race_type='', source='plattsys',
        place=place, first_name=first, last_name=last,
        city=' '.join(city_tokens), state=state,
        age=age, gender=gender, division=division, div_place=div_place,
        total_time=total, swim_time=swim, bike_time=bike, run_time=run, bib=bib,
    )


def parse_columnar(text, year, race_type):
    results = []
    for line in text.split('\n'):
        if re.search(r'PLACE|FIRST|LAST|OVERALL|===|---', line, re.I) and not re.match(r'^\s*\d', line):
            continue
        if not line.strip() or len(line.strip()) < 20:
            continue
        r = parse_columnar_line(line)
        if r and r['firstName'] and r['lastName'] and r['place']:
            r['year'] = year
            r['raceType'] = race_type
            results.append(r)
    return results


def detect_and_parse(text, year, race_type):
    if re.search(r'={5,}', text):
        return parse_equals(text, year, race_type)
    if re.search(r'^-{4,}', text, re.M) and re.search(r'Rank', text, re.I):
        return parse_1999(text, year, race_type)
    return parse_columnar(text, year, race_type)


def scrape_plattsys():
    print('Scraping PlatSys (1999–2005)...')
    all_results = []
    for year, race_type, url in RACES:
        try:
            r = requests.get(url, headers=HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'lxml')
            biggest_text = ''
            for pre in soup.find_all('pre'):
                raw = pre.decode_contents()
                text = re.sub(r'<[^>]+>', '', raw)
                if len(text) > len(biggest_text):
                    biggest_text = text
            if not biggest_text.strip():
                print(f'  {year} {race_type}: no pre content')
                continue
            rows = detect_and_parse(biggest_text, year, race_type)
            valid = [r for r in rows if r['firstName'] and r['lastName'] and r['place'] and r['place'] < 2000]
            print(f'  {year} {race_type}: {len(valid)} results')
            all_results.extend(valid)
        except Exception as e:
            print(f'  {year} {race_type} FAILED: {e}')
        time.sleep(0.3)
    return all_results
