import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { computeBalances, formatMoney, settleUp } from '../lib/balances';
import { useExpenses, useHousehold, usePenalties, useSplits } from '../lib/db';

export function Money() {
  const { userId } = useAuth();
  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();
  const penalties = usePenalties();

  const personOf = (id: string) => house.data?.find((p) => p.id === id);
  const nameOf = (id: string) => personOf(id)?.display_name ?? 'Someone';

  const facedName = (id: string) => (
    <Link className="faced faced-link" to={`/house/${id}`}>
      <Avatar
        rosterKey={personOf(id)?.roster_key ?? null}
        name={nameOf(id)}
        url={personOf(id)?.avatar_url}
        size={26}
      />
      {nameOf(id)}
    </Link>
  );

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);

  const balances = useMemo(
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds),
    [expenses.data, splits.data, memberIds]
  );

  const transfers = useMemo(() => settleUp(balances), [balances]);

  /**
   * Fines are totalled apart from the shopping and never enter settleUp(). A
   * $10 is owed to the house rather than to whoever happened to pay at the
   * till, so netting it against groceries would quietly cancel a punishment
   * against a receipt.
   */
  const fines = useMemo(() => {
    const byPerson = new Map<string, number>();
    for (const penalty of penalties.data ?? []) {
      byPerson.set(penalty.user_id, (byPerson.get(penalty.user_id) ?? 0) + Number(penalty.amount));
    }
    return byPerson;
  }, [penalties.data]);

  const finesTotal = [...fines.values()].reduce((sum, n) => sum + n, 0);
  const mine = balances.find((b) => b.user_id === userId)?.net ?? 0;
  const myFines = fines.get(userId ?? '') ?? 0;

  const loading = house.isLoading || expenses.isLoading || splits.isLoading;

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">The ledger</p>
        {loading ? (
          <h1 className="wordmark">Counting</h1>
        ) : mine > 0.004 ? (
          <h1 className="wordmark">
            You are owed <span className="figure">{formatMoney(mine)}</span>
          </h1>
        ) : mine < -0.004 ? (
          <h1 className="wordmark">
            You owe <span className="figure">{formatMoney(mine)}</span>
          </h1>
        ) : (
          <h1 className="wordmark">All square</h1>
        )}
        {myFines > 0 && (
          <p className="lede" style={{ color: 'var(--coral)', maxWidth: 'none' }}>
            Plus <span className="figure">{formatMoney(myFines)}</span> in fines to the house.
          </p>
        )}
      </header>

      <Link className="btn ask stack-lg rise rise-2" to="/money/add">
        Did someone do a grocery run?
      </Link>

      {transfers.length > 0 && (
        <section className="panel stack-lg rise rise-3">
          <p className="tag">Settling up takes {transfers.length} transfer{transfers.length > 1 ? 's' : ''}</p>
          <ul className="roster-list">
            {transfers.map((t, i) => (
              <li key={`${t.from}-${t.to}-${i}`}>
                <span>
                  {nameOf(t.from)} pays {nameOf(t.to)}
                </span>
                <span className="figure">{formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel stack-lg rise rise-3">
        <p className="tag">Where everyone stands</p>
        <ul className="roster-list">
          {balances
            .slice()
            .sort((a, b) => b.net - a.net)
            .map((balance) => (
              <li key={balance.user_id}>
                {facedName(balance.user_id)}
                <span
                  className="figure"
                  style={{
                    color:
                      balance.net > 0.004
                        ? 'var(--aqua)'
                        : balance.net < -0.004
                          ? 'var(--coral)'
                          : 'var(--ink-faint)',
                  }}
                >
                  {balance.net > 0.004 ? '+' : balance.net < -0.004 ? '-' : ''}
                  {formatMoney(balance.net)}
                </span>
              </li>
            ))}
        </ul>
      </section>

      {/* Deliberately its own panel, below the groceries, in coral. */}
      {finesTotal > 0 && (
        <section className="panel panel-fines stack-lg rise rise-4">
          <p className="tag">Fines owed to the house</p>
          <ul className="roster-list">
            {[...fines.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([personId, amount]) => (
                <li key={personId}>
                  {facedName(personId)}
                  <span className="figure" style={{ color: 'var(--coral)' }}>
                    {formatMoney(amount)}
                  </span>
                </li>
              ))}
          </ul>
          <p className="tag" style={{ marginTop: 12, letterSpacing: '0.08em' }}>
            Kept out of the split above. A fine is owed to the house, not to whoever paid.
          </p>
        </section>
      )}

      <section className="stack-lg rise rise-5">
        <p className="tag">Recent</p>
        {expenses.data?.length === 0 ? (
          <p className="lede">Nothing logged yet.</p>
        ) : (
          <ul className="strip">
            {expenses.data?.slice(0, 12).map((expense) => (
              <li key={expense.id}>
                <div className="expense-row">
                  <span className="strip-when tag figure">{expense.created_at.slice(0, 10)}</span>
                  <span className="strip-who">{expense.description || 'Groceries'}</span>
                  <span className="expense-meta tag">{nameOf(expense.paid_by)} paid</span>
                  <span className="figure expense-amount">{formatMoney(Number(expense.amount))}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
