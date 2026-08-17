import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { computeBalances, formatMoney } from '../lib/balances';
import { APARTMENTS } from '../lib/categories';
import { useExpenses, useHousehold, useSplits } from '../lib/db';

export function People() {
  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();

  const [flat, setFlat] = useState<string | null>(null);

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);

  // Balances always cover the whole house. Filtering is about who you are
  // looking at, not about recalculating what they owe.
  const shown = (house.data ?? []).filter((p) => !flat || p.apartment === flat);

  const balances = useMemo(
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds, []),
    [expenses.data, splits.data, memberIds]
  );

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">घरबार</p>
        <h1 className="wordmark">The house</h1>
        <p className="lede">Six people, two flats, one dinner table.</p>
      </header>

      <div className="chips stack-lg rise rise-2">
        <button
          className={`chip${flat === null ? ' is-on' : ''}`}
          onClick={() => setFlat(null)}
        >
          All
        </button>
        {APARTMENTS.map((option) => (
          <button
            key={option}
            className={`chip${flat === option ? ' is-on' : ''}`}
            onClick={() => setFlat(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="people-grid stack-lg">
        {shown.map((person, i) => {
          const net = balances.find((b) => b.user_id === person.id)?.net ?? 0;

          return (
            <Link
              key={person.id}
              to={`/house/${person.id}`}
              className="person-card rise"
              style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            >
              <Avatar
                rosterKey={person.roster_key}
                name={person.display_name}
                url={person.avatar_url}
                size={62}
              />
              <span className="person-name">{person.display_name}</span>
              <span className="tag">{person.apartment ?? ''}</span>

              <span
                className="figure person-net"
                style={{
                  color:
                    net > 0.004 ? 'var(--aqua)' : net < -0.004 ? 'var(--coral)' : 'var(--ink-faint)',
                }}
              >
                {net > 0.004 ? `owed ${formatMoney(net)}` : net < -0.004 ? `owes ${formatMoney(net)}` : 'square'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
