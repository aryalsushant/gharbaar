import { dateRange } from './rotation';

export type BirthdayNotice = {
  userId: string;
  name: string;
  /** 0 for today, 1 for tomorrow. */
  daysAway: number;
  turning: number | null;
};

/**
 * Birthdays are compared on month and day only, never as whole dates, so the
 * year of birth never enters the comparison and a leap-year birthday still
 * matches on the 29th when there is one.
 *
 * Both the stored date and today's key are local-calendar YYYY-MM-DD strings,
 * so this is string slicing rather than date arithmetic, and no timezone gets
 * a chance to move anybody's birthday a day.
 */
export function birthdaysAround(
  people: { id: string; display_name: string; date_of_birth: string | null }[],
  todayKey: string
): BirthdayNotice[] {
  const [today, tomorrow] = dateRange(todayKey, 2);
  const notices: BirthdayNotice[] = [];

  for (const person of people) {
    if (!person.date_of_birth) continue;
    const born = person.date_of_birth.slice(5); // MM-DD

    const daysAway = born === today.slice(5) ? 0 : born === tomorrow.slice(5) ? 1 : null;
    if (daysAway === null) continue;

    const birthYear = Number(person.date_of_birth.slice(0, 4));
    const onYear = Number((daysAway === 0 ? today : tomorrow).slice(0, 4));
    const turning = Number.isFinite(birthYear) ? onYear - birthYear : null;

    notices.push({
      userId: person.id,
      name: person.display_name,
      daysAway,
      turning,
    });
  }

  return notices.sort((a, b) => a.daysAway - b.daysAway);
}
