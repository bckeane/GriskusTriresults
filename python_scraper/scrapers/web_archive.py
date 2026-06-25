"""
Scraper for 2006–2008 race results via the Wayback Machine.
roadntracksports.com pages use a ===== separator fixed-width format with
columns: Place, No, Name, Age, S, City, St, Div/Tot, Div, [ranks and splits].
"""
import re
import time
from .normalizer import make_result
from .wayback import fetch_wayback

RACES = [
    (2006, 'Olympic',
     'https://web.archive.org/web/20110305052626/http://roadntracksports.com/RaceResults/Griskus_Olympic_Triathlon_2006.html'),
    (2006, 'Sprint',
     'https://web.archive.org/web/20120808155340/http://www.roadntracksports.com/RaceResults/Griskus_Sprint_Tri_2006.html'),
    (2007, 'Olympic',
     'https://web.archive.org/web/20110305052259/http://www.roadntracksports.com/RaceResults/Griskus%20Olympic%20Triathlon%202007.html'),
    (2007, 'Sprint',
     'https://web.archive.org/web/20120808013531/http://www.roadntracksports.com/RaceResults/2007%20Griskus%20Sprint%20Triathlon.html'),
    (2008, 'Olympic',
     'https://web.archive.org/web/20090224013120/http://roadntracksports.com/RaceResults/Pat_Griskus_Olympic_Triathlon_2008.html'),
    (2008, 'Sprint',
     'https://web.archive.org/web/20100412223851/http://roadntracksports.com/RaceResults/2008_Pat_Griskus_Sprint_Triathlon_2008.htm'),
]

IS_TIME = re.compile(r'^\d{1,2}:\d{2}(:\d{2})?$')
IS_LONG = re.compile(r'^\d:\d{2}:\d{2}$')


def col_ranges(sep_line):
    ranges, in_block, start = [], False, 0
    for i, ch in enumerate(sep_line + ' '):
        if ch in '-=':
            if not in_block:
                in_block, start = True, i
        else:
            if in_block:
                ranges.append((start, i))
                in_block = False
    return ranges


def detect_col(header, ranges, *keywords):
    """Return first column index whose header window (s to next col start) contains any keyword."""
    header_up = header.upper()
    for idx, (s, e) in enumerate(ranges):
        next_s = ranges[idx + 1][0] if idx + 1 < len(ranges) else len(header_up)
        chunk = header_up[s:next_s]
        for kw in keywords:
            ku = kw.upper()
            pos = chunk.find(ku)
            if pos == -1:
                continue
            before = chunk[pos - 1] if pos > 0 else ' '
            after_ch = chunk[pos + len(ku)] if pos + len(ku) < len(chunk) else ' '
            if not before.isalpha() and not after_ch.isalpha():
                return idx
    return -1


def detect_div_col(header, ranges):
    """Find the actual division/category column (not Div/Tot ratio)."""
    header_up = header.upper()
    for idx, (s, e) in enumerate(ranges):
        next_s = ranges[idx + 1][0] if idx + 1 < len(ranges) else len(header_up)
        chunk = header_up[s:next_s].strip()
        if chunk.startswith('DIV') and not chunk.startswith('DIV/'):
            return idx
        if chunk.startswith('DIVISION') or chunk.startswith('CAT'):
            return idx
    return -1


def parse_section(lines, sep_idx, year, race_type):
    """Parse one results section starting at sep_idx."""
    ranges = col_ranges(lines[sep_idx])
    if len(ranges) < 8:
        return []

    header = lines[sep_idx - 1] if sep_idx > 0 else ''

    col_place = 0
    col_bib   = detect_col(header, ranges, 'NO.', 'NO ', 'BIB', 'NUM')
    col_name  = detect_col(header, ranges, 'NAME')
    col_age   = detect_col(header, ranges, 'AGE')
    col_gender = detect_col(header, ranges, 'SEX', 'GENDER', 'M/F', ' S', 'S ')
    col_city  = detect_col(header, ranges, 'CITY', 'TOWN', 'HOME')
    col_state = detect_col(header, ranges, ' ST', 'STATE')
    col_div   = detect_div_col(header, ranges)

    # Fall back to positional defaults (2007 standard layout)
    if col_bib == -1:   col_bib = 1
    if col_name == -1:  col_name = 2
    if col_age == -1:   col_age = 3
    if col_gender == -1: col_gender = 4
    if col_city == -1:  col_city = 5
    if col_state == -1: col_state = 6

    # Splits start after the last non-time column
    splits_start = max(col_place, col_bib, col_name, col_age, col_gender,
                       col_city, col_state, col_div if col_div != -1 else 0) + 1

    results = []
    # Stop at the next separator line
    for line in lines[sep_idx + 1:]:
        if re.match(r'\s*={5,}', line):
            break
        if not line.strip() or re.match(r'^\s*[-=]', line):
            continue
        cols = [line[s:e].strip() if s < len(line) else '' for s, e in ranges]
        if not cols:
            continue

        try:
            place = int(cols[0])
        except ValueError:
            continue
        if place <= 0 or place > 5000:
            continue

        full_name = cols[col_name].strip() if col_name < len(cols) else ''
        if not full_name:
            continue
        parts = full_name.split()
        if len(parts) < 2:
            continue
        first = parts[0]
        last = ' '.join(parts[1:])

        age_str = cols[col_age] if col_age < len(cols) else ''
        gender = cols[col_gender].strip().upper() if col_gender < len(cols) else ''
        city = cols[col_city] if col_city < len(cols) else ''
        state = cols[col_state] if col_state < len(cols) else ''
        division = cols[col_div].strip().upper() if col_div != -1 and col_div < len(cols) else ''

        # Collect time values from split columns (rank numbers are filtered out)
        times = [col for col in cols[splits_start:] if IS_TIME.match(col)]

        # Standard layout: swim, T1, bike, T2, run, total (6 times)
        # Total is always last; swim is first; run is second-to-last
        net_time  = times[-1] if times else ''
        swim_time = times[0] if len(times) >= 2 else ''
        run_time  = times[-2] if len(times) >= 2 else ''

        # Bike: prefer H:MM:SS detection (Olympic), fall back to position 2 (Sprint)
        long_times = [t for t in times if IS_LONG.match(t)]
        if len(long_times) >= 2:
            bike_time = long_times[-2]  # Olympic: bike is H:MM:SS
        elif len(times) >= 5:
            bike_time = times[2]  # Sprint: standard swim/T1/bike/T2/run/total order
        elif len(times) >= 3:
            bike_time = times[1]  # abbreviated: swim, bike, run, total
        else:
            bike_time = ''

        try:
            age = int(age_str) if age_str else None
        except ValueError:
            age = None

        results.append(make_result(
            year=year, race_type=race_type, source='web_archive',
            place=place, first_name=first, last_name=last,
            city=city, state=state, age=age, gender=gender,
            division=division,
            total_time=net_time, swim_time=swim_time,
            bike_time=bike_time, run_time=run_time,
            bib=cols[col_bib] if col_bib < len(cols) else '',
        ))

    return results


def parse_roadntrack(text, year, race_type):
    """Parse all individual-result sections from a roadntracksports page."""
    lines = text.split('\n')

    # Find all separator lines (===== markers)
    sep_indices = [i for i, l in enumerate(lines) if re.search(r'={5,}', l)]
    if not sep_indices:
        return []

    all_results = []
    seen_names = set()

    for sep_idx in sep_indices:
        header = lines[sep_idx - 1] if sep_idx > 0 else ''
        header_up = header.upper()
        # Skip team relay sections (no NAME column containing individual athlete names)
        if 'NAME' not in header_up:
            continue
        # Skip sections that look like pure team relay (Teamname column)
        if "TEAMNAME" in header_up or "TEAM NAME" in header_up:
            continue

        section_results = parse_section(lines, sep_idx, year, race_type)

        # Dedup within page by fullName: same athlete appears in overall +
        # by-division + by-gender sections with different place numbers.
        # Keep the first occurrence (from the overall section).
        for r in section_results:
            key = r['fullName'].lower()
            if key not in seen_names:
                seen_names.add(key)
                all_results.append(r)

    return all_results


def fetch_and_parse(year, race_type, url):
    try:
        _, html = fetch_wayback(url)
        text = re.sub(r'<[^>]+>', '', html)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&lt;', '<', text)
        text = re.sub(r'&gt;', '>', text)
        text = re.sub(r'&nbsp;', ' ', text)
        rows = parse_roadntrack(text, year, race_type)
        print(f'  {year} {race_type}: {len(rows)} results')
        return rows
    except Exception as e:
        print(f'  {year} {race_type} FAILED: {e}')
        return []


def scrape_web_archive():
    print('Scraping Wayback Machine (2006–2008)...')
    all_results = []
    for year, race_type, url in RACES:
        rows = fetch_and_parse(year, race_type, url)
        all_results.extend(rows)
        time.sleep(3)
    return all_results
