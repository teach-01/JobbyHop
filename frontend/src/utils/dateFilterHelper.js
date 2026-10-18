/**
 * Date Filter Helper for JobbyHop Admin
 * Provides consistent date range calculations and record filtering across all Admin pages.
 */

export const DATE_FILTER_PRESETS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Date Range' },
];

export const DEFAULT_DATE_FILTER = {
  preset: 'all',
  startDate: '',
  endDate: '',
};

export const KOLKATA_TIMEZONE = 'Asia/Kolkata';
export const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms

/**
 * Returns { year, month, date } in Asia/Kolkata for a given Date or timestamp.
 * month is 0-indexed (0 = Jan, 11 = Dec).
 */
export const getKolkataDateParts = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOLKATA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.format(d).split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1,
    date: parseInt(parts[2], 10),
  };
};

/**
 * Converts year, month (0-11), date, and time in Asia/Kolkata to epoch UTC ms.
 */
export const kolkataToUtcMs = (year, month, date, hours = 0, minutes = 0, seconds = 0, ms = 0) => {
  return Date.UTC(year, month, date, hours, minutes, seconds, ms) - KOLKATA_OFFSET_MS;
};

export const parseBoundary = (dateStr, isEnd = false) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    const parts = getKolkataDateParts(dateStr);
    if (!parts) return null;
    return isEnd
      ? kolkataToUtcMs(parts.year, parts.month, parts.date, 23, 59, 59, 999)
      : kolkataToUtcMs(parts.year, parts.month, parts.date, 0, 0, 0, 0);
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  const sep = str.includes('/') ? '/' : str.includes('-') ? '-' : null;
  if (sep) {
    const parts = str.split(sep).map(p => Number(p));
    if (parts.length === 3 && !parts.some(isNaN)) {
      let y, m, d;
      if (parts[0] > 1000) {
        // YYYY-MM-DD or YYYY/MM/DD
        y = parts[0];
        m = parts[1] - 1;
        d = parts[2];
      } else if (parts[2] > 1000) {
        // Year is the 3rd part (e.g. 2026)
        y = parts[2];
        if (parts[0] > 12) {
          // DD-MM-YYYY
          d = parts[0];
          m = parts[1] - 1;
        } else if (parts[1] > 12) {
          // MM-DD-YYYY
          m = parts[0] - 1;
          d = parts[1];
        } else {
          // Both <= 12: default to MM/DD/YYYY
          m = parts[0] - 1;
          d = parts[1];
        }
      }
      if (y !== undefined && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return isEnd
          ? kolkataToUtcMs(y, m, d, 23, 59, 59, 999)
          : kolkataToUtcMs(y, m, d, 0, 0, 0, 0);
      }
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const parts = getKolkataDateParts(parsed);
    if (parts) {
      return isEnd
        ? kolkataToUtcMs(parts.year, parts.month, parts.date, 23, 59, 59, 999)
        : kolkataToUtcMs(parts.year, parts.month, parts.date, 0, 0, 0, 0);
    }
  }

  return null;
};

/**
 * Returns { start, end } boundary timestamps in epoch UTC milliseconds for a given preset and custom dates
 * evaluated in the Asia/Kolkata timezone.
 * Returns null if preset is 'all' or if custom dates are empty.
 */
export const getDateRangeBoundaries = (dateFilter) => {
  if (!dateFilter || dateFilter.preset === 'all') {
    return null;
  }

  const { year, month, date } = getKolkataDateParts(new Date());

  switch (dateFilter.preset) {
    case 'today': {
      const start = kolkataToUtcMs(year, month, date, 0, 0, 0, 0);
      const end = kolkataToUtcMs(year, month, date, 23, 59, 59, 999);
      return { start, end };
    }

    case 'yesterday': {
      const yDayRef = new Date(Date.UTC(year, month, date - 1));
      const start = kolkataToUtcMs(yDayRef.getUTCFullYear(), yDayRef.getUTCMonth(), yDayRef.getUTCDate(), 0, 0, 0, 0);
      const end = kolkataToUtcMs(yDayRef.getUTCFullYear(), yDayRef.getUTCMonth(), yDayRef.getUTCDate(), 23, 59, 59, 999);
      return { start, end };
    }

    case 'last_7_days': {
      const past7Ref = new Date(Date.UTC(year, month, date - 6));
      const start = kolkataToUtcMs(past7Ref.getUTCFullYear(), past7Ref.getUTCMonth(), past7Ref.getUTCDate(), 0, 0, 0, 0);
      const end = kolkataToUtcMs(year, month, date, 23, 59, 59, 999);
      return { start, end };
    }

    case 'last_30_days': {
      const past30Ref = new Date(Date.UTC(year, month, date - 29));
      const start = kolkataToUtcMs(past30Ref.getUTCFullYear(), past30Ref.getUTCMonth(), past30Ref.getUTCDate(), 0, 0, 0, 0);
      const end = kolkataToUtcMs(year, month, date, 23, 59, 59, 999);
      return { start, end };
    }

    case 'this_month': {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const start = kolkataToUtcMs(year, month, 1, 0, 0, 0, 0);
      const end = kolkataToUtcMs(year, month, lastDay, 23, 59, 59, 999);
      return { start, end };
    }

    case 'last_month': {
      const prevMonthRef = new Date(Date.UTC(year, month, 0));
      const lmYear = prevMonthRef.getUTCFullYear();
      const lmMonth = prevMonthRef.getUTCMonth();
      const lmLastDay = prevMonthRef.getUTCDate();
      const start = kolkataToUtcMs(lmYear, lmMonth, 1, 0, 0, 0, 0);
      const end = kolkataToUtcMs(lmYear, lmMonth, lmLastDay, 23, 59, 59, 999);
      return { start, end };
    }

    case 'custom': {
      if (!dateFilter.startDate && !dateFilter.endDate) {
        return null;
      }

      const start = parseBoundary(dateFilter.startDate, false) ?? -Infinity;
      const end = parseBoundary(dateFilter.endDate, true) ?? Infinity;

      return { start, end };
    }

    default:
      return null;
  }
};

/**
 * Checks if a given raw date value falls within the active date filter in Asia/Kolkata.
 * Safely handles strings, numbers, Date objects, null/undefined.
 */
export const matchesDateFilter = (rawDate, dateFilter) => {
  if (!dateFilter || dateFilter.preset === 'all') {
    return true;
  }

  if (!rawDate) {
    return false;
  }

  const range = getDateRangeBoundaries(dateFilter);
  if (!range) {
    return true;
  }

  let recordTime = NaN;
  if (typeof rawDate === 'number') {
    recordTime = rawDate;
  } else if (rawDate instanceof Date) {
    recordTime = rawDate.getTime();
  } else if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      recordTime = kolkataToUtcMs(y, m - 1, d, 12, 0, 0, 0);
    } else {
      recordTime = new Date(trimmed).getTime();
    }
  }

  if (isNaN(recordTime)) {
    return false;
  }

  return recordTime >= range.start && recordTime <= range.end;
};

