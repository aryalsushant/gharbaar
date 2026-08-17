/**
 * Has anybody quietly ended up cooking more than their share?
 *
 * Cover requests are generous by design, and generosity compounds without
 * anybody noticing. Swap enough nights and one person is four dinners ahead
 * while everyone remembers it as "a couple of times".
 *
 * This is a count, not a rule. Nothing is charged, nothing is enforced, and
 * nobody is told off. It exists so the house can see the drift and sort it out
 * the way housemates do, which is the same reason the $10 was removed.
 *
 * Only sign-offs count, never the rota. Being scheduled to cook is not cooking,
 * and the whole point is to measure what actually happened.
 */

export type Standing = {
  userId: string;
  cooked: number;
  /** Nights above or below the house average. Zero when everyone is level. */
  delta: number;
};

export function standings(
  completions: { user_id: string }[],
  memberIds: string[]
): { average: number; byPerson: Map<string, Standing> } {
  const byPerson = new Map<string, Standing>(
    memberIds.map((id) => [id, { userId: id, cooked: 0, delta: 0 }])
  );

  for (const done of completions) {
    const standing = byPerson.get(done.user_id);
    if (standing) standing.cooked++;
  }

  const average = memberIds.length ? completions.length / memberIds.length : 0;
  for (const standing of byPerson.values()) {
    standing.delta = standing.cooked - average;
  }

  return { average, byPerson };
}

/**
 * Half a night either way is rounding, not unfairness, so only speak up past a
 * whole dinner. Otherwise the counter would nag at everybody permanently, since
 * the average is almost never a round number.
 */
export function fairnessNote(standing: Standing | undefined): string | null {
  if (!standing) return null;
  // Compared against a whole night, not a rounded one. Rounding first means
  // 0.83 becomes "1 ahead", which is the counter nagging about most of a
  // dinner rather than a dinner.
  if (standing.delta >= 1) return `${Math.round(standing.delta)} ahead`;
  if (standing.delta <= -1) return `${Math.round(Math.abs(standing.delta))} behind`;
  return null;
}
