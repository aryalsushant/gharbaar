import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import {
  useChoreChecks,
  useChores,
  useHousehold,
  useMarkChore,
  useRoster,
  type Chore,
  type ChoreCheck,
} from '../lib/db';
import { toDateKey } from '../lib/rotation';

/**
 * The nightly round: six fixed jobs, one per person, answered by whoever owns
 * them.
 *
 * Split in two on purpose. Your own corner belongs at the very top of the
 * board, above the cooking, because it is the one thing on the screen that is
 * asking you to do something. Everybody else's belongs further down, as a
 * glance, because a list of five jobs that are not yours is information rather
 * than a request.
 *
 * Both halves read the same three queries. React Query hands out one copy of
 * each, so this costs nothing over doing it in one component and saves passing
 * six props down the board.
 */

/** Today's answers, keyed the way both halves want to look them up. */
function useRound() {
  const { userId } = useAuth();
  const todayKey = toDateKey(new Date());

  const chores = useChores();
  const checks = useChoreChecks(todayKey);
  const house = useHousehold();
  const roster = useRoster();

  const me = userId ? house.data?.find((p) => p.id === userId) : undefined;

  /** Yes, no, or nothing said yet. */
  const answerTo = (choreId: string): boolean | null => {
    const check = (checks.data ?? []).find((c: ChoreCheck) => c.chore_id === choreId);
    return check ? check.done : null;
  };

  return {
    userId,
    todayKey,
    chores: chores.data ?? [],
    // A house that has not run the migration yet should show the board it had
    // yesterday, not an error where the cooking used to be.
    broken: chores.isError,
    answerTo,
    me,
    house: house.data ?? [],
    roster: roster.data ?? [],
  };
}

/** Your corner of the kitchen, and the two ways to answer for it. */
export function MyChores() {
  const { userId, todayKey, chores, broken, answerTo, me } = useRound();
  const mark = useMarkChore(todayKey);

  const mine = me?.roster_key ? chores.filter((c) => c.roster_key === me.roster_key) : [];
  if (broken || !userId || mine.length === 0) return null;

  function answer(chore: Chore, next: boolean) {
    // Tapping the answer you already gave takes it back. Without this a mistap
    // is permanent for the rest of the day.
    const current = answerTo(chore.id);
    mark.mutate({ choreId: chore.id, userId: userId!, done: current === next ? null : next });
  }

  return (
    <section className="panel stack-lg rise rise-1 chore-mine">
      <p className="tag">Yours every day</p>

      {mine.map((chore) => {
        const given = answerTo(chore.id);
        return (
          <div key={chore.id} className="chore-block">
            <p className="chore-title">{chore.title}</p>
            <div className="chore-answer">
              <button
                className={`btn btn-quiet btn-small chore-yes${given === true ? ' is-on' : ''}`}
                disabled={mark.isPending}
                onClick={() => answer(chore, true)}
              >
                Done
              </button>
              <button
                className={`btn btn-quiet btn-small chore-no${given === false ? ' is-on' : ''}`}
                disabled={mark.isPending}
                onClick={() => answer(chore, false)}
              >
                Not today
              </button>
            </div>
          </div>
        );
      })}

      <p className="tag chore-hint">
        {mine.every((chore) => answerTo(chore.id) !== null)
          ? 'Tap an answer again to take it back. It clears at midnight either way.'
          : 'Nobody else answers this one. It clears at midnight.'}
      </p>
    </section>
  );
}

/** The whole round at a glance: who said yes, who said no, who has not said. */
export function ChoreRound() {
  const { userId, chores, broken, answerTo, house, roster } = useRound();
  if (broken || chores.length === 0) return null;

  const rank = new Map(roster.map((seat) => [seat.key, seat.sort_order]));
  const inOrder = [...chores].sort(
    (a, b) => (rank.get(a.roster_key) ?? 99) - (rank.get(b.roster_key) ?? 99)
  );

  const answered = chores.filter((c) => answerTo(c.id) === true).length;

  return (
    <section className="stack-lg rise rise-4">
      <div className="spread">
        <p className="tag">The round</p>
        <p className="tag figure">
          {answered} of {chores.length} done
        </p>
      </div>

      <ul className="roster-list chore-round">
        {inOrder.map((chore) => {
          const person = house.find((p) => p.roster_key === chore.roster_key);
          const seat = roster.find((s) => s.key === chore.roster_key);
          const name = person?.display_name ?? seat?.display_name ?? 'Empty seat';
          const given = answerTo(chore.id);

          return (
            <li key={chore.id}>
              <span className="faced">
                <Avatar
                  rosterKey={chore.roster_key}
                  name={name}
                  url={person?.avatar_url ?? null}
                  size={26}
                />
                <span className="chore-line">
                  <span>{person && person.id === userId ? 'You' : name}</span>
                  <span className="chore-what">{chore.title}</span>
                </span>
              </span>

              <span
                className={`flag ${given === true ? 'flag-done' : given === false ? 'flag-miss' : 'flag-open'}`}
              >
                {given === true ? 'done' : given === false ? 'not today' : 'no answer'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
