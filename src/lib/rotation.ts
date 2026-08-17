/**
 * Rotation is computed, never scheduled. There is no cron job and no stored
 * "whose turn is it today" row: given the rotation start date and the ordered
 * member list, the assignee for any date falls out of a modulo. That means the
 * answer is identical on every device and for any date, past or future.
 */

export type RotationMember = {
  user_id: string;
  rotation_order: number;
  is_active: boolean;
};

export type Responsibility = {
  id: string;
  name: string;
  rotation_start_date: string; // YYYY-MM-DD
};

export type Override = {
  date: string; // YYYY-MM-DD
  user_id: string;
};

/** Local-calendar date as YYYY-MM-DD. Avoids the UTC shift of toISOString(). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as local midnight, not UTC midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days between two date keys. Immune to DST because it re-reads the calendar fields. */
export function daysBetween(startKey: string, endKey: string): number {
  const start = fromDateKey(startKey);
  const end = fromDateKey(endKey);
  const ms = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.round(ms / 86_400_000);
}

/**
 * Who owns this responsibility on this date?
 *
 *   1. An explicit override for that date always wins (this is the swap feature).
 *   2. Otherwise: index = daysSinceStart mod activeMemberCount, over members
 *      sorted by rotation_order.
 *
 * Returns null when there are no active members. Dates before the rotation
 * start date still resolve — JS `%` yields negatives, so the result is
 * normalised back into range.
 */
export function getAssignee(
  responsibility: Responsibility,
  members: RotationMember[],
  overrides: Override[],
  dateKey: string
): string | null {
  const override = overrides.find((o) => o.date === dateKey);
  if (override) return override.user_id;

  const active = members
    .filter((m) => m.is_active)
    .sort((a, b) => a.rotation_order - b.rotation_order);

  if (active.length === 0) return null;

  const days = daysBetween(responsibility.rotation_start_date, dateKey);
  const index = ((days % active.length) + active.length) % active.length;
  return active[index].user_id;
}

/** The next `count` days starting at `startKey`, as date keys. */
export function dateRange(startKey: string, count: number): string[] {
  const start = fromDateKey(startKey);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return toDateKey(d);
  });
}
