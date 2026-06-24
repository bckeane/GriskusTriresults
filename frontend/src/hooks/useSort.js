import { useState, useMemo } from 'react';
import { parseTimeForSort } from '../utils/time.js';

const TIME_KEYS = new Set(['totalTime', 'swimTime', 'bikeTime', 'runTime']);

export function useSort(rows, defaultKey, defaultDir = 'asc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      let av = a[key], bv = b[key];
      if (TIME_KEYS.has(key)) {
        av = parseTimeForSort(av); bv = parseTimeForSort(bv);
      } else if (typeof av === 'string' || typeof bv === 'string') {
        av = (av ?? '').toString().toLowerCase();
        bv = (bv ?? '').toString().toLowerCase();
      } else {
        av = av ?? Infinity; bv = bv ?? Infinity;
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sort]);

  function toggle(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  return { sorted, sort, toggle };
}
