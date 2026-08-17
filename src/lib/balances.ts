/**
 * Balance math, done entirely in integer cents. Splitting 10.00 three ways in
 * floating point gives you three 3.3333s that do not add back up to the
 * expense, and the error compounds across a group's history.
 */

export type ExpenseRow = {
  id: string;
  paid_by: string;
  amount: number;
};

export type SplitRow = {
  expense_id: string;
  user_id: string;
  amount_owed: number;
};

export type SettlementRow = {
  from_user: string;
  to_user: string;
  amount: number;
};

export type Balance = {
  user_id: string;
  /** Positive: the group owes them. Negative: they owe the group. */
  net: number;
};

export type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export const toCents = (amount: number): number => Math.round(amount * 100);
export const fromCents = (cents: number): number => cents / 100;

/**
 * Split a total into `count` shares that sum back to exactly the total.
 * The remainder pennies go to the first shares, so 10.00/3 => 3.34, 3.33, 3.33.
 */
export function splitEqually(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Net position per user: what they paid out, minus what they owe, minus what
 * has already been handed over in cash.
 *
 * A settlement moves the needle in both directions at once. Paying somebody
 * $20 lifts you by 20 and drops them by 20, which is exactly what would have
 * happened if the debt had never existed. Without this the settle-up list would
 * repeat the same advice forever, because the ledger would never hear that
 * anybody acted on it.
 */
export function computeBalances(
  expenses: ExpenseRow[],
  splits: SplitRow[],
  memberIds: string[],
  settlements: SettlementRow[] = []
): Balance[] {
  const net = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const bump = (userId: string, cents: number) => {
    net.set(userId, (net.get(userId) ?? 0) + cents);
  };

  for (const expense of expenses) {
    bump(expense.paid_by, toCents(expense.amount));
  }
  for (const split of splits) {
    bump(split.user_id, -toCents(split.amount_owed));
  }
  for (const settlement of settlements) {
    bump(settlement.from_user, toCents(settlement.amount));
    bump(settlement.to_user, -toCents(settlement.amount));
  }

  return Array.from(net, ([user_id, cents]) => ({ user_id, net: fromCents(cents) }));
}

/**
 * Greedy debt simplification: repeatedly settle the largest debtor against the
 * largest creditor. Produces at most n-1 transfers rather than one per expense.
 */
export function settleUp(balances: Balance[]): Settlement[] {
  const debtors = balances
    .map((b) => ({ user_id: b.user_id, cents: toCents(b.net) }))
    .filter((b) => b.cents < 0)
    .sort((a, b) => a.cents - b.cents);
  const creditors = balances
    .map((b) => ({ user_id: b.user_id, cents: toCents(b.net) }))
    .filter((b) => b.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const owed = Math.min(-debtors[i].cents, creditors[j].cents);
    if (owed > 0) {
      settlements.push({
        from: debtors[i].user_id,
        to: creditors[j].user_id,
        amount: fromCents(owed),
      });
      debtors[i].cents += owed;
      creditors[j].cents -= owed;
    }
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }

  return settlements;
}

export function formatMoney(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}
