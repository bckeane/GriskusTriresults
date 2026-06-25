"""
Shared Wayback Machine utilities: CDX API lookup, caching, and rate-limit-aware fetching.

Flow for each URL:
  1. Check local cache (python_scraper/cache/wayback/) — return immediately if hit.
  2. Query CDX API (separate rate-limit pool) to find the best available snapshot.
  3. Fetch the snapshot with exponential-backoff retry on 429.
  4. Save raw bytes to cache so future runs (and --force re-runs) skip the network.

Manual seeding: drop a file into cache/wayback/ named after the sanitized original
URL (printed as "cache miss" on first run) and the scraper will read it directly.
"""
import re
import time
import urllib.parse
import requests
from pathlib import Path

CDX_API = 'https://web.archive.org/cdx/search/cdx'
CACHE_DIR = Path(__file__).parent.parent / 'cache' / 'wayback'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}

_WAYBACK_RE = re.compile(r'https?://web\.archive\.org/web/(\d+)/(.*)', re.IGNORECASE)


def parse_wayback_url(url):
    """Return (timestamp_str, original_url) from a Wayback URL, or (None, url)."""
    m = _WAYBACK_RE.match(url)
    if m:
        return m.group(1), m.group(2)
    return None, url


def _cache_path(original_url):
    """Derive a stable, human-readable cache filename from the original URL."""
    decoded = urllib.parse.unquote(original_url)
    parsed = urllib.parse.urlparse(decoded)
    name = re.sub(r'[^\w\-.]', '_', parsed.netloc + parsed.path).strip('_')
    return CACHE_DIR / name


def cdx_lookup(original_url, near_timestamp=None, timeout=20):
    """
    Query CDX to find the best available snapshot of original_url.

    If near_timestamp (14-digit string like '20110305052626') is given, finds
    the snapshot closest to that date. Otherwise returns the most recent one.

    Returns the full https://web.archive.org/web/TIMESTAMP/URL string, or None
    if no successful snapshot exists in the archive.
    """
    params = {
        'url': original_url,
        'output': 'json',
        'limit': 1,
        'filter': 'statuscode:200',
        'fl': 'timestamp,original',
    }
    if near_timestamp:
        params['closest'] = near_timestamp
        params['sort'] = 'closest'

    r = requests.get(CDX_API, params=params, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    rows = r.json()
    # rows[0] is the header ['timestamp', 'original']; rows[1+] are results
    if len(rows) < 2:
        return None
    timestamp, original = rows[1]
    return f'https://web.archive.org/web/{timestamp}/{original}'


def _fetch_raw(wayback_or_original_url, near_timestamp=None,
               max_retries=3, base_delay=15, cdx_delay=2.0):
    """
    Fetch raw bytes for a Wayback URL, checking cache first.
    On cache miss: CDX lookup → fetch with retry → save to cache.
    Returns (source_description, bytes).
    """
    ts, original = parse_wayback_url(wayback_or_original_url)
    effective_ts = near_timestamp or ts

    cache_file = _cache_path(original)
    if cache_file.exists():
        print(f'    cache hit: {cache_file.name}')
        return str(cache_file), cache_file.read_bytes()

    print(f'    cache miss: {cache_file.name}')
    print(f'    CDX lookup: {original}')
    snapshot_url = cdx_lookup(original, near_timestamp=effective_ts)
    time.sleep(cdx_delay)

    if snapshot_url is None:
        raise Exception(f'No archived snapshot found in CDX for {original}')

    for attempt in range(max_retries):
        r = requests.get(snapshot_url, headers=HEADERS, timeout=45)
        if r.status_code == 429:
            wait = base_delay * (2 ** attempt)
            print(f'    rate limited (attempt {attempt + 1}/{max_retries}), waiting {wait}s...')
            time.sleep(wait)
            continue
        r.raise_for_status()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(r.content)
        print(f'    saved → {cache_file.name}')
        return snapshot_url, r.content

    raise Exception(f'Still rate-limited after {max_retries} retries: {snapshot_url}')


def fetch_wayback(wayback_or_original_url, near_timestamp=None, **kwargs):
    """Fetch page text, using local cache if available. Returns (url, text)."""
    url, raw = _fetch_raw(wayback_or_original_url, near_timestamp, **kwargs)
    return url, raw.decode('utf-8', errors='replace')


def fetch_wayback_bytes(wayback_or_original_url, near_timestamp=None, **kwargs):
    """Fetch raw bytes, using local cache if available. Returns (url, bytes)."""
    return _fetch_raw(wayback_or_original_url, near_timestamp, **kwargs)
