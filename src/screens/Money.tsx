import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { computeBalances, formatMoney, settleUp } from '../lib/balances';
import { categoryLabel } from '../lib/categories';
import { dateKeyOf, mediumDate } from '../lib/dates';
import {
  useExpenses,
  useHousehold,
  useRecordSettlement,
  useSettlements,
  useSplits,
} from '../lib/db';

export function Money() {
  const { userId } = useAuth();
  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();
  const settlements = useSettlements();
  const record = useRecordSettlement();
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [opened, setOpened] = useState<string | null>(null);

  const personOf = (id: string) => house.data?.find((p) => p.id === id);
  const nameOf = (id: string) => personOf(id)?.display_name ?? 'Someone';

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);

  const balances = useMemo(
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds, settlements.data ?? []),
    [expenses.data, splits.data, memberIds, settlements.data]
  );

  const transfers = useMemo(() => settleUp(balances), [balances]);

  const mine = balances.find((b) => b.user_id === userId)?.net ?? 0;

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

      <section className="stack-lg rise rise-3">
        <p className="tag">Where everyone stands</p>
        <div className="money-grid">
          {balances
            .slice()
            .sort((a, b) => b.net - a.net)
            .map((balance, i) => {
              const person = personOf(balance.user_id);
              const owed = balance.net > 0.004;
              const owes = balance.net < -0.004;

              return (
                <Link
                  key={balance.user_id}
                  to={`/house/${balance.user_id}`}
                  className={`money-card${owed ? ' is-owed' : owes ? ' is-owing' : ''}`}
                  style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                >
                  <Avatar
                    rosterKey={person?.roster_key ?? null}
                    name={nameOf(balance.user_id)}
                    url={person?.avatar_url}
                    size={64}
                  />
                  <span className="money-name">{nameOf(balance.user_id)}</span>
                  <span className="figure money-amount">
                    {owed ? '+' : owes ? '-' : ''}
                    {formatMoney(balance.net)}
                  </span>
                  <span className="tag">{owed ? 'is owed' : owes ? 'owes' : 'square'}</span>
                </Link>
              );
            })}
        </div>
      </section>

      <section className="stack-lg rise rise-5">
        <p className="tag">Everything logged</p>
        {expenses.data?.length === 0 ? (
          <p className="lede">Nothing logged yet.</p>
        ) : (
          <ul className="strip">
            {expenses.data?.map((expense) => {
              const mine = (splits.data ?? []).filter((s) => s.expense_id === expense.id);
              const open = opened === expense.id;

              return (
                <li key={expense.id}>
                  <button
                    className={`expense-row${open ? ' is-open' : ''}`}
                    onClick={() => setOpened(open ? null : expense.id)}
                  >
                    <span className="strip-when tag">{mediumDate(dateKeyOf(expense.created_at))}</span>
                    <span className="strip-who">
                      {expense.description || categoryLabel(expense.category)}
                    </span>
                    <span className="expense-meta tag">
                      {categoryLabel(expense.category)}
                      {expense.apartment ? ` · ${expense.apartment}` : ''} ·{' '}
                      {nameOf(expense.paid_by)} paid · split {mine.length}{' '}
                      {mine.length === 1 ? 'way' : 'ways'}
                    </span>
                    <span className="figure expense-amount">
                      {formatMoney(Number(expense.amount))}
                    </span>
                  </button>

                  {open && (
                    <>
                    <ul className="split-detail">
                      {mine.map((share) => (
                        <li key={share.id}>
                          <span className="faced">
                            <Avatar
                              rosterKey={personOf(share.user_id)?.roster_key ?? null}
                              name={nameOf(share.user_id)}
                              url={personOf(share.user_id)?.avatar_url}
                              size={22}
                            />
                            {nameOf(share.user_id)}
                          </span>
                          <span className="figure">{formatMoney(Number(share.amount_owed))}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="split-detail" style={{ paddingTop: 0 }}>
                      <Link className="link" to={`/money/${expense.id}/edit`}>
                        Edit or delete this
                      </Link>
                    </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
