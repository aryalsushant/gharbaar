import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { computeBalances, formatMoney, settleUp } from '../lib/balances';
import {
  useCompletions,
  useExpenses,
  useHousehold,
  usePenalties,
  useResponsibilities,
  useSplits,
} from '../lib/db';

type Entry = { date: string; kind: 'paid' | 'cooked' | 'signed' | 'fined'; text: string; amount?: number };

export function Person() {
  const { id = '' } = useParams();
  const { userId } = useAuth();

  const house = useHousehold();
  const expenses = useExpenses();
  const splits = useSplits();
  const penalties = usePenalties();
  const responsibilities = useResponsibilities();
  const completions = useCompletions(responsibilities.data?.[0]?.id);

  const person = house.data?.find((p) => p.id === id);
  const nameOf = (who: string) => house.data?.find((p) => p.id === who)?.display_name ?? 'Someone';

  const memberIds = useMemo(() => (house.data ?? []).map((p) => p.id), [house.data]);
  const balances = useMemo(
    () => computeBalances(expenses.data ?? [], splits.data ?? [], memberIds),
    [expenses.data, splits.data, memberIds]
  );

  const net = balances.find((b) => b.user_id === id)?.net ?? 0;
  const isMe = id === userId;

  /**
   * What passes between the two of you specifically.
   *
   * There is no such thing as a true pairwise debt here: everybody pays into
   * one pot and the ledger only knows each person's net. So this shows the
   * transfer the settle-up plan actually proposes between you two, which is the
   * number that would really change hands, rather than inventing a figure by
   * subtracting one net from another.
   */
  const between = useMemo(() => {
    if (isMe || !userId) return null;
    return (
      settleUp(balances).find(
        (t) => (t.from === userId && t.to === id) || (t.from === id && t.to === userId)
      ) ?? null
    );
  }, [balances, id, userId, isMe]);

  const fines = (penalties.data ?? []).filter((p) => p.user_id === id);
  const finesTotal = fines.reduce((sum, p) => sum + Number(p.amount), 0);
  const cooked = (completions.data ?? []).filter((c) => c.user_id === id);
  const signedOff = (completions.data ?? []).filter((c) => c.marked_by === id);
  const paid = (expenses.data ?? []).filter((e) => e.paid_by === id);

  const activity = useMemo<Entry[]>(() => {
    const entries: Entry[] = [
      ...paid.map((e) => ({
        date: e.created_at.slice(0, 10),
        kind: 'paid' as const,
        text: e.description || 'Groceries',
        amount: Number(e.amount),
      })),
      ...cooked.map((c) => ({ date: c.date, kind: 'cooked' as const, text: 'Cooked and cleaned' })),
      ...signedOff.map((c) => ({
        date: c.date,
        kind: 'signed' as const,
        text: `Signed off ${nameOf(c.user_id)}`,
      })),
      ...fines.map((p) => ({
        date: p.date,
        kind: 'fined' as const,
        text: p.reason || 'Missed a night',
        amount: Number(p.amount),
      })),
    ];
    return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  }, [paid, cooked, signedOff, fines, house.data]);

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

      <section className="panel stack-lg rise rise-2">
        <div className="spread">
          <span className="tag">Across the house</span>
          <span
            className="figure"
            style={{
              fontSize: '1.2rem',
              color: net > 0.004 ? 'var(--aqua)' : net < -0.004 ? 'var(--coral)' : 'var(--ink-faint)',
            }}
          >
            {net > 0.004
              ? `owed ${formatMoney(net)}`
              : net < -0.004
                ? `owes ${formatMoney(net)}`
                : 'square'}
          </span>
        </div>

        {between && (
          <p className="notice notice-good" style={{ marginTop: 16, marginBottom: 0 }}>
            {between.from === userId
              ? `You pay ${person.display_name} `
              : `${person.display_name} pays you `}
            <span className="figure">{formatMoney(between.amount)}</span> to settle up.
          </p>
        )}

        {!between && !isMe && (
          <p className="tag" style={{ marginTop: 14, letterSpacing: '0.08em' }}>
            Nothing passes directly between you two in the current settle-up.
          </p>
        )}
      </section>

      <section className="stat-row stack-lg rise rise-3">
        <div className="stat">
          <span className="figure stat-value">{cooked.length}</span>
          <span className="tag">nights cooked</span>
        </div>
        <div className="stat">
          <span className="figure stat-value">{paid.length}</span>
          <span className="tag">times paid</span>
        </div>
        <div className="stat">
          <span className="figure stat-value">{signedOff.length}</span>
          <span className="tag">sign-offs given</span>
        </div>
        <div className="stat">
          <span
            className="figure stat-value"
            style={{ color: finesTotal > 0 ? 'var(--coral)' : undefined }}
          >
            {formatMoney(finesTotal)}
          </span>
          <span className="tag">in fines</span>
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
                  <span className="strip-when tag figure">{entry.date}</span>
                  <span className="strip-who">{entry.text}</span>
                  <span className="expense-meta tag">{entry.kind}</span>
                  {entry.amount !== undefined && (
                    <span
                      className="figure expense-amount"
                      style={{ color: entry.kind === 'fined' ? 'var(--coral)' : undefined }}
                    >
                      {formatMoney(entry.amount)}
                    </span>
                  )}
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
