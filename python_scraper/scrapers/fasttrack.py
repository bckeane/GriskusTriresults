"""
FastTrack Timing scraper for Pat Griskus Olympic Triathlon results, 2009–2014.

FastTrack was the timing vendor for this era. Results are archived on the
Wayback Machine from fasttrackcoaching.net.

We scrape Olympic only — Sprint for these years is already covered by Athlinks
(which has better split data). The 2010 Olympic was never archived.

File formats encountered:
  2009: PDF  — pdfplumber text extraction, then token-based parsing (column
               positions don't survive PDF→text so we can't use col_ranges)
  2011–2013: plain .txt — same ===== fixed-width layout as roadntracksports
  2014: HTML (RR360 format) — strip tags, then same fixed-width layout
"""
import io
import re
import time
import pdfplumber
from .normalizer import make_result
from .web_archive import parse_roadntrack
from .wayback import fetch_wayback, fetch_wayback_bytes

# (year, race_type, wayback_url)
# Sprint omitted — Athlinks covers 2009–2016 Sprint with splits.
# 2010 Olympic: never archived on Wayback Machine.
RACES = [
    (2011, 'Olympic',
     'http://web.archive.org/web/20150717135930/http://www.fasttrackcoaching.net:80/timing/Results/2011-PAT-GRISKUS-OLYMPIC-TRIATHLON-RESULTS.txt'),
    (2012, 'Olympic',
     'http://web.archive.org/web/20200130042628/http://www.fasttrackcoaching.net:80/timing/Results/2012-PAT-GRISKUS-OLYMPIC-DISTANCE-TRIATHLON-RESULTS.txt'),
    (2013, 'Olympic',
     'http://web.archive.org/web/20150707104354/http://www.fasttrackcoaching.net:80/timing/Results/2013-PAT-GRISKUS-OLYMPIC-DISTANCE-TRIATHLON-RESULTS.txt'),
    (2014, 'Olympic',
     'http://web.archive.org/web/20150708223246/http://www.fasttrackcoaching.net:80/timing/Results/2014-PGOT-RESULTS-RR360.html'),
]

PDF_RACES = [
    (2009, 'Olympic',
     'http://web.archive.org/web/20120824031900/http://fasttrackcoaching.net:80/timing/Results/2009PatGriskusOlympicResults.pdf'),
]


def _strip_html(html):
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&nbsp;', ' ', text)
    return text


def fetch_text(year, race_type, url):
    try:
        _, html = fetch_wayback(url)
        text = _strip_html(html)
        rows = parse_roadntrack(text, year, race_type)
        print(f'  {year} {race_type}: {len(rows)} results')
        return rows
    except Exception as e:
        print(f'  {year} {race_type} FAILED: {e}')
        return []


_TIME_RE = re.compile(r'^\d{1,2}:\d{2}(:\d{2})?$')


def _parse_pdf_row(line, year, race_type):
    """
    Token-based parser for FastTrack PDF rows. pdfplumber collapses
    whitespace so col_ranges() positions don't align with data — instead
    we work from the known structure:
      Place Bib Name... Gender Age Div/Tot DivGroup City... State Wave
      Swim Tran1 Bike Tran2 Run Finish
    We anchor from the right (6 times) and left (place, bib), then
    find gender by locating the first isolated M/F followed by a number.
    """
    tokens = line.split()
    if len(tokens) < 10:
        return None
    try:
        place = int(tokens[0])
    except ValueError:
        return None
    if place <= 0 or place > 5000:
        return None

    bib = tokens[1]
    rest = tokens[2:]

    # Strip 6 time fields from the right
    if len(rest) < 8 or not all(_TIME_RE.match(rest[-i]) for i in range(1, 7)):
        return None
    finish, run_t, tran2, bike, tran1, swim = (rest[-1], rest[-2], rest[-3],
                                                rest[-4], rest[-5], rest[-6])
    rest = rest[:-6]

    # Strip wave (single digit) and state (2-letter code) from the right
    if len(rest) < 2:
        return None
    wave, state = rest[-1], rest[-2]
    rest = rest[:-2]

    # Find gender: first M/F token whose next token is a valid age integer
    gender_idx = None
    for i, tok in enumerate(rest[:-2]):
        if tok in ('M', 'F'):
            try:
                int(rest[i + 1])
                gender_idx = i
                break
            except (ValueError, IndexError):
                continue
    if gender_idx is None:
        return None

    name_tokens = rest[:gender_idx]
    gender = rest[gender_idx]
    after = rest[gender_idx + 1:]

    if len(after) < 3:
        return None
    age_str, divtot, divgroup = after[0], after[1], after[2]
    city = ' '.join(after[3:])

    full_name = ' '.join(name_tokens)
    parts = full_name.split()
    if len(parts) < 2:
        return None
    first, last = parts[0], ' '.join(parts[1:])

    try:
        age = int(age_str)
    except ValueError:
        age = None

    return make_result(
        year=year, race_type=race_type, source='fasttrack',
        place=place, first_name=first, last_name=last,
        city=city, state=state, age=age, gender=gender,
        division=divgroup,
        total_time=finish, swim_time=swim,
        bike_time=bike, run_time=run_t,
        bib=bib,
    )


def _parse_pdf_text(full_text, year, race_type):
    results, seen = [], set()
    for line in full_text.split('\n'):
        r = _parse_pdf_row(line.strip(), year, race_type)
        if r:
            key = r['fullName'].lower()
            if key not in seen:
                seen.add(key)
                results.append(r)
    return results


def fetch_pdf(year, race_type, url):
    try:
        _, pdf_bytes = fetch_wayback_bytes(url)
        text_lines = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text(x_tolerance=3, y_tolerance=3)
                if page_text:
                    text_lines.append(page_text)
        full_text = '\n'.join(text_lines)
        rows = _parse_pdf_text(full_text, year, race_type)
        print(f'  {year} {race_type} (PDF): {len(rows)} results')
        return rows
    except Exception as e:
        print(f'  {year} {race_type} PDF FAILED: {e}')
        return []


def scrape_fasttrack():
    print('Scraping FastTrack Timing via Wayback Machine (2009–2014 Olympic)...')
    all_results = []

    for year, race_type, url in PDF_RACES:
        rows = fetch_pdf(year, race_type, url)
        all_results.extend(rows)
        time.sleep(20)

    for year, race_type, url in RACES:
        rows = fetch_text(year, race_type, url)
        all_results.extend(rows)
        time.sleep(20)

    return all_results
