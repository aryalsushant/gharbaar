/**
 * One way of writing a date, everywhere.
 *
 * The app was showing 2026-08-19 in some places, Wed, Aug 19 in others, and
 * 08-17 in the ledger. Machine dates are fine in a database and hostile in a
 * notification, where somebody reads one line on a lock screen and has to work
 * out whether it means tonight.
 *
 * Built from the calendar fields rather than through toISOString, for the same
 * reason the rotation is: that would shift the day backwards for anyone west of
 * UTC, which is all six of them.
 */

import { toDateKey } from './rotation';

/**
 * The local calendar day of a timestamp from the database.
 *
 * Postgres hands back created_at in UTC, and slicing the first ten characters
 * off it gives the UTC day, which after about seven in the evening here is
 * already tomorrow. Read it as a Date and take the local fields instead.
 */
export function dateKeyOf(timestamp: string): string {
  return toDateKey(new Date(timestamp));
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 1st, 2nd, 3rd, 4th. The teens are all th, which is the part people get wrong. */
export function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function parts(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d, weekday: new Date(y, m - 1, d).getDay() };
}

/** Wednesday 19th August. For notifications, where there is no other context. */
export function longDate(key: string): string {
  const { m, d, weekday } = parts(key);
  return `${DAYS[weekday]} ${ordinal(d)} ${MONTHS[m - 1]}`;
}

/** 19th August. When the weekday is noise. */
export function mediumDate(key: string): string {
  const { m, d } = parts(key);
  return `${ordinal(d)} ${MONTHS[m - 1]}`;
}

/** Wed 19th Aug. For lists, where it has to stay narrow. */
export function shortDate(key: string): string {
  const { m, d, weekday } = parts(key);
  return `${DAYS[weekday].slice(0, 3)} ${ordinal(d)} ${MONTHS[m - 1].slice(0, 3)}`;
}
