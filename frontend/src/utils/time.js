function parse(t) {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// Returns seconds as a number, or null for missing/unparseable input.
// Use this when null means "no data" (e.g. chart gap).
export function parseTimeSeconds(t) {
  return parse(t);
}

// Returns seconds as a number, or Infinity for missing/unparseable input.
// Use this for sort comparisons where nulls should sort last.
export function parseTimeForSort(t) {
  const s = parse(t);
  return s === null ? Infinity : s;
}

// Format seconds back to H:MM:SS or M:SS string.
export function formatSeconds(s) {
  if (s == null || !isFinite(s)) return '—';
  const rounded = Math.round(s);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const sec = rounded % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
