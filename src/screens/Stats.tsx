import { useMemo } from 'react';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { StarMark } from '../components/RateDinner';
import { useHousehold, useRatingStats, useRoster, type RatingStat } from '../lib/db';

/** 4.3, or nothing at all when there is nothing to average. */
function average(value: number, count: number): string | null {
  return count > 0 ? value.toFixed(1) : null;
}

/**
 * How dinner has been going, by the stars.
 *
 * Totals and averages only. Who gave which stars is not readable by anybody,
 * this screen included, so a low score is a nudge from the house rather than
 * a note from one person.
 *
 * Every seat is listed, rated or not, so the six rows never reshuffle as the
 * first ratings arrive, and somebody with no ratings yet reads as exactly that
 * rather than as missing.
 */
export function Stats() {
  const roster = useRoster();
  const house = useHousehold();
  const stats = useRatingStats();

  const rows = useMemo(() => {
    const byUser = new Map((stats.data ?? []).map((s) => [s.user_id, s]));
    return [...(roster.data ?? [])]
      .sort(
        (a, b) =>
          (a.cook_order ?? 99) - (b.cook_order ?? 99) || a.sort_order - b.sort_order
      )
      .map((seat) => {
        const person = house.data?.find((p) => p.roster_key === seat.key);
        const stat: RatingStat | undefined = person ? byUser.get(person.id) : undefined;
        return {
          key: seat.key,
          name: person?.display_name ?? seat.display_name,
          avatar: person?.avatar_url ?? null,
          ratings: stat?.ratings ?? 0,
          cooking: stat?.cooking ?? 0,
          cleaning: stat?.cleaning ?? 0,
        };
      });
  }, [roster.data, house.data, stats.data]);

  // House averages weighted by how many ratings each person has, so one
  // five star night does not count the same as twenty fours.
  const total = rows.reduce((sum, r) => sum + r.ratings, 0);
  const houseCooking = total ? rows.reduce((sum, r) => sum + r.cooking * r.ratings, 0) / total : 0;
  const houseCleaning = total ? rows.reduce((sum, r) => sum + r.cleaning * r.ratings, 0) / total : 0;

  if (roster.isLoading || house.isLoading || stats.isLoading) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">Reading the house</p>
      </div>
    );
  }

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">Dinner, by the stars</p>
        <h1 className="wordmark">Stats</h1>
        <p className="lede">
          Everybody but the cook rates the night. Who gave which stars stays private.
        </p>
      </header>

      {stats.isError ? (
        <p className="notice notice-bad rise rise-2">
          Could not read the ratings. {stats.error.message}
        </p>
      ) : (
        <>
          <section className="stat-row stat-row-three stack-lg rise rise-2">
            <div className="stat">
              <span className="tag">Ratings</span>
              <span className="figure stat-value">{total}</span>
            </div>
            <div className="stat">
              <span className="tag">Cooking</span>
              <span className="figure stat-value">{average(houseCooking, total) ?? 'none'}</span>
            </div>
            <div className="stat">
              <span className="tag">Cleaning</span>
              <span className="figure stat-value">{average(houseCleaning, total) ?? 'none'}</span>
            </div>
          </section>

          <section className="stack-lg rise rise-3">
            <div className="rating-table-head">
              <span className="tag">Cook</span>
              <span className="tag">Cooking</span>
              <span className="tag">Cleaning</span>
              <span className="tag">Ratings</span>
            </div>
            <ul className="roster-list rating-table">
              {rows.map((row) => (
                <li key={row.key}>
                  <span className="faced">
                    <Avatar rosterKey={row.key} name={row.name} url={row.avatar} size={26} />
                    {row.name}
                  </span>
                  <Score value={average(row.cooking, row.ratings)} />
                  <Score value={average(row.cleaning, row.ratings)} />
                  <span className="figure rating-count">{row.ratings}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Score({ value }: { value: string | null }) {
  if (value === null) return <span className="rating-score is-none">none</span>;
  return (
    <span className="figure rating-score">
      {value}
      <StarMark />
    </span>
  );
}
