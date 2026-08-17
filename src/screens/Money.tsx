import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { computeBalances, formatMoney, settleUp } from '../lib/balances';
import {
  useExpenses,
  useHousehold,
  usePenalties,
  useRecordSettlement,
  useSettlements,
  useSplits,
} from '../lib/db';

export function Money() {
  const { userId } = useAuth();
  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();
  const penalties = usePenalties();
  const settlements = useSettlements();
  const record = useRecordSettlement();
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

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
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds, settlements.data ?? [], penalties.data ?? []),
    [expenses.data, splits.data, memberIds, settlements.data, penalties.data]
  );

  const transfers = useMemo(() => settleUp(balances), [balances]);

  /**
   * Totalled per person for display only. The money itself is handled in
   * computeBalances, which splits each fine among everyone else, so it settles
   * like any other debt. This panel exists so a bad week stays visible instead
   * of disappearing into the grocery maths.
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
          {error && <p className="notice notice-bad">{error}</p>}
          <ul className="roster-list">
            {transfers.map((t, i) => {
              const key = `${t.from}-${t.to}-${i}`;
              const open = settling === key;

              return (
                <li key={key} className={open ? 'settling' : undefined}>
                  <span>
                    {t.from === userId ? 'You pay' : `${nameOf(t.from)} pays`}{' '}
                    {t.to === userId ? 'you' : nameOf(t.to)}
                  </span>

                  <span className="row" style={{ gap: 12 }}>
                    <span className="figure">{formatMoney(t.amount)}</span>
                    {t.to === userId && !open && (
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          setError(null);
                          // Prefilled with what is owed, since that is what
                          // usually changes hands, but it is a starting point
                          // rather than an assumption.
                          setAmount(t.amount.toFixed(2));
                          setSettling(key);
                        }}
                      >
                        They paid me
                      </button>
                    )}
                  </span>

                  {open && (
                    <form
                      className="settle-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        setError(null);
                        try {
                          await record.mutateAsync({
                            fromUser: t.from,
                            toUser: userId!,
                            amount: Number(amount),
                          });
                          setSettling(null);
                          setAmount('');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Could not record that.');
                        }
                      }}
                    >
                      <span className="tag">How much did {nameOf(t.from)} hand over?</span>
                      <div className="row" style={{ marginTop: 8 }}>
                        <div className="amount-field" style={{ flex: 1 }}>
                          <span className="amount-sign figure" style={{ fontSize: '1rem', left: 14 }}>
                            $
                          </span>
                          <input
                            className="input figure"
                            style={{ paddingLeft: 30, fontSize: '1rem' }}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max={t.amount}
                            autoFocus
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn btn-small"
                          type="submit"
                          disabled={record.isPending || !(Number(amount) > 0)}
                        >
                          {record.isPending ? 'Saving' : 'Record'}
                        </button>
                        <button
                          className="link"
                          type="button"
                          onClick={() => {
                            setSettling(null);
                            setError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      {Number(amount) > 0 && Number(amount) < t.amount && (
                        <p className="tag" style={{ marginTop: 8, letterSpacing: '0.08em' }}>
                          Part payment. {nameOf(t.from)} will still owe{' '}
                          {formatMoney(t.amount - Number(amount))}.
                        </p>
                      )}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="tag" style={{ marginTop: 12, letterSpacing: '0.08em' }}>
            Only the person being paid can mark a transfer done, so nobody can clear a debt
            by saying they settled it.
          </p>
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
            Split among everyone else, so a $10 puts $2 in front of each of the other five
            and settles like any other debt. Listed here separately so a bad week is
            visible rather than buried in the grocery maths.
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
