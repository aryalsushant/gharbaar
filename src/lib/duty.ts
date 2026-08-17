import { shortDate } from './dates';
import {
  dateRange,
  getAssignee,
  type Override,
  type Responsibility,
  type RotationMember,
} from './rotation';

export type DutyDay = {
  date: string;
  /** Null only when the rotation has no active members. */
  assignee: string | null;
  /** True when an override row put somebody other than the computed person here. */
  swapped: boolean;
};

/** The next `count` days from `startKey`, each resolved to whoever owns it. */
export function buildStrip(
  responsibility: Responsibility,
  members: RotationMember[],
  overrides: Override[],
  startKey: string,
  count: number
): DutyDay[] {
  return dateRange(startKey, count).map((date) => ({
    date,
    assignee: getAssignee(responsibility, members, overrides, date),
    swapped: overrides.some((o) => o.date === date),
  }));
}

export type SwapPlan = {
  /** Override rows to write. One row means a cover with nothing traded back. */
  rows: { date: string; user_id: string }[];
  /** The day the original person picks up instead, when there is one. */
  tradedTo: string | null;
};

/**
 * Trading two days, not deferring a queue.
 *
 * If Chetan covers Suwan's Monday, Suwan takes Chetan's next day rather than
 * cooking on Tuesday. Nobody else in the rotation moves, and both of them still
 * cook exactly once per cycle. That is the whole reason this can stay two
 * override rows instead of stored queue state: `getAssignee()` keeps computing
 * every other day from the modulo, untouched.
 *
 * Returns null when there is nothing to do, and a single-row plan when the
 * person covering is not in the rotation at all, since then there is no day of
 * theirs to hand back.
 */
export function planSwap(
  responsibility: Responsibility,
  members: RotationMember[],
  overrides: Override[],
  dateKey: string,
  coverUserId: string
): SwapPlan | null {
  const current = getAssignee(responsibility, members, overrides, dateKey);
  if (!current || current === coverUserId) return null;

  const active = members.filter((m) => m.is_active);
  const coverIsInRotation = active.some((m) => m.user_id === coverUserId);

  if (!coverIsInRotation) {
    return { rows: [{ date: dateKey, user_id: coverUserId }], tradedTo: null };
  }

  // Look ahead far enough to pass every member twice. Two cycles is more than
  // enough to find their next turn even when existing swaps have shuffled it,
  // and it keeps the search bounded rather than looping on a broken rotation.
  const horizon = Math.max(active.length * 2, 14);
  const upcoming = dateRange(dateKey, horizon + 1).slice(1);

  const theirNext = upcoming.find(
    (date) => getAssignee(responsibility, members, overrides, date) === coverUserId
  );

  if (!theirNext) {
    return { rows: [{ date: dateKey, user_id: coverUserId }], tradedTo: null };
  }

  return {
    rows: [
      { date: dateKey, user_id: coverUserId },
      { date: theirNext, user_id: current },
    ],
    tradedTo: theirNext,
  };
}

/** Today, Tomorrow, or Wed 19th Aug. */
export function dayLabel(dateKey: string, todayKey: string): string {
  const [tomorrow] = dateRange(todayKey, 2).slice(1);
  if (dateKey === todayKey) return 'Today';
  if (dateKey === tomorrow) return 'Tomorrow';
  return shortDate(dateKey);
}
