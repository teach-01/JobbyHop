/**
 * Time utility functions for 24-hour time values and 12-hour display.
 */

// Regex for strictly valid 24-hour time "HH:mm" (00:00 to 23:59)
export const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validates whether a value is a strictly valid 24-hour time string ("HH:mm").
 */
export const isValid24HourTime = (val) => {
  if (typeof val !== 'string') return false;
  return TIME_24H_REGEX.test(val.trim());
};

/**
 * Safely parses any legacy or existing time string to a standardized 24-hour "HH:mm" string.
 * Supports:
 * - "HH:mm" / "H:mm" (24h)
 * - "hh:mm AM/PM" / "h:mm am/pm" (12h)
 * Returns:
 * - "HH:mm" if parseable
 * - "" if empty / null / undefined
 * - null if unparseable / invalid legacy text (e.g. "SAKJJADFJ")
 */
export const parseTo24HourTime = (val) => {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return '';
  }

  const str = val.trim();

  // Check 24-hour format: H:mm or HH:mm
  const match24 = str.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // Check 12-hour format: h:mm AM/PM or hh:mm AM/PM
  const match12 = str.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const meridiem = match12[3].toUpperCase();

    if (hours < 1 || hours > 12) return null;

    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // If unparseable (e.g. random text "SAKJJADFJ"), return null
  return null;
};

/**
 * Returns a display-ready object for UI rendering:
 * {
 *   status: 'empty' | 'valid' | 'invalid',
 *   label: string, // e.g. "10:30 AM", "Invalid Time", "—"
 *   raw: string
 * }
 */
export const formatDisplayTime = (val) => {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return { status: 'empty', label: '—', raw: '' };
  }

  const parsed24 = parseTo24HourTime(val);

  if (parsed24 === null) {
    return { status: 'invalid', label: 'Invalid Time', raw: val };
  }

  if (parsed24 === '') {
    return { status: 'empty', label: '—', raw: '' };
  }

  const [hStr, mStr] = parsed24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr;

  const meridiem = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  const label = `${String(displayHours).padStart(2, '0')}:${m} ${meridiem}`;

  return { status: 'valid', label, raw: val, value24: parsed24 };
};
