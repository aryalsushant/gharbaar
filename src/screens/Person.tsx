import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { mediumDate } from '../lib/dates';
import { fairnessNote, standings } from '../lib/fairness';
import {
  dinnerOf,
  useCompletions,
  useHousehold,
  useResponsibilities,
  useRoster,
} from '../lib/db';

type Entry = {
  date: string;
  kind: 'cooked' | 'signed';
  text: string;
};

export function Person() {
  const { id = '' } = useParams();
  const { userId } = useAuth();

  const house = useHousehold();
  const responsibilities = useResponsibilities();
  const roster = useRoster();
  const completions = useCompletions(dinnerOf(responsibilities.data)?.id);

  const person = house.data?.find((p) => p.id === id);
  const nameOf = (who: string) => house.data?.find((p) => p.id === who)?.display_name ?? 'Someone';

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);
  const isMe = id === userId;

  const cooked = (completions.data ?? []).filter((c) => c.user_id === id);
  const signedOff = (completions.data ?? []).filter((c) => c.marked_by === id);

  const everybodyIn = (house.data?.length ?? 0) >= (roster.data?.length ?? 6);
  const { byPerson } = standings(completions.data ?? [], memberIds);
  const note = fairnessNote(byPerson.get(id));

  const activity = useMemo<Entry[]>(() => {
    const entries: Entry[] = [
      ...cooked.map((c) => ({ date: c.date, kind: 'cooked' as const, text: 'Cooked and cleaned' })),
      ...signedOff.map((c) => ({
        date: c.date,
        kind: 'signed' as const,
        text: `Signed off ${nameOf(c.user_id)}`,
      })),
    ];
    return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  }, [cooked, signedOff, house.data]);

  if (!person) {
    return (
      <div className="centered wide">
        <Nav />
        <p className="lede rise rise-1">Nobody here by that name.</p>
        <Link className="link" to="/house">
          Back to the house
        </Link>
      </div>
    );
  }

  return (
    <div className="centered wide">
      <Nav />

      <header className="person-head rise rise-1">
        <Avatar
          rosterKey={person.roster_key}
          name={person.display_name}
          url={person.avatar_url}
          size={110}
        />
        <div>
          <p className="tag">{isMe ? 'You' : person.roster_key}</p>
          <h1 className="wordmark" style={{ fontSize: 'clamp(2.2rem, 9vw, 3rem)' }}>
            {person.display_name}
          </h1>
        </div>
      </header>

      <section className="stat-row stack-lg rise rise-3">
        <div className="stat">
          <span className="figure stat-value">{cooked.length}</span>
          <span className="tag">
            nights cooked
            {everybodyIn && note ? ` · ${note}` : ''}
          </span>
        </div>
        <div className="stat">
          <span className="figure stat-value">{signedOff.length}</span>
          <span className="tag">sign-offs given</span>
        </div>
      </section>

      <section className="stack-lg rise rise-4">
        <p className="tag">Activity</p>
        {activity.length === 0 ? (
          <p className="lede">Nothing yet.</p>
        ) : (
          <ul className="strip">
            {activity.map((entry, i) => (
              <li key={`${entry.kind}-${entry.date}-${i}`}>
                <div className="expense-row">
                  <span className="strip-when tag">{mediumDate(entry.date)}</span>
                  <span className="strip-who">{entry.text}</span>
                  <span className="expense-meta tag">{entry.kind}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="footer-row rise rise-5">
        <Link className="link" to="/house">
          Everyone else
        </Link>
      </footer>
    </div>
  );
}
