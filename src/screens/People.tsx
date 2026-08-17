import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { computeBalances, formatMoney } from '../lib/balances';
import { useExpenses, useHousehold, usePenalties, useSplits } from '../lib/db';

export function People() {
  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();
  const penalties = usePenalties();

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);

  const balances = useMemo(
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds),
    [expenses.data, splits.data, memberIds]
  );

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">घरबार</p>
        <h1 className="wordmark">The house</h1>
        <p className="lede">Six people. Tap anyone to see where they stand.</p>
      </header>

      <div className="people-grid stack-lg">
        {house.data?.map((person, i) => {
          const net = balances.find((b) => b.user_id === person.id)?.net ?? 0;
          const fines = (penalties.data ?? [])
            .filter((p) => p.user_id === person.id)
            .reduce((sum, p) => sum + Number(p.amount), 0);

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

              <span
                className="figure person-net"
                style={{
                  color:
                    net > 0.004 ? 'var(--aqua)' : net < -0.004 ? 'var(--coral)' : 'var(--ink-faint)',
                }}
              >
                {net > 0.004 ? `owed ${formatMoney(net)}` : net < -0.004 ? `owes ${formatMoney(net)}` : 'square'}
              </span>

              {fines > 0 && <span className="flag flag-fined">{formatMoney(fines)} fines</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
