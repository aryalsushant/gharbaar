import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { formatMoney, splitEqually, toCents } from '../lib/balances';
import { useAddExpense, useHousehold } from '../lib/db';

export function AddExpense() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const house = useHousehold();
  const addExpense = useAddExpense();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [sharedBy, setSharedBy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Default to everyone, and to me paying, once the household has loaded.
  useEffect(() => {
    if (!house.data) return;
    setSharedBy((current) => (current.length ? current : house.data.map((p) => p.id)));
    setPaidBy((current) => current ?? userId);
  }, [house.data, userId]);

  const cents = toCents(Number(amount) || 0);

  /**
   * The exact shares, shown before anything is saved. Splitting in cents means
   * $10 across 6 is 1.67, 1.67, 1.67, 1.67, 1.66, 1.66, which adds back to
   * exactly $10. Showing it beforehand is also the honest way to admit that
   * two people pay a penny less.
   */
  const shares = useMemo(
    () => (sharedBy.length ? splitEqually(cents, sharedBy.length) : []),
    [cents, sharedBy.length]
  );

  const uneven = shares.length > 1 && shares[0] !== shares[shares.length - 1];
  const ready = cents > 0 && sharedBy.length > 0 && !!paidBy;

  function toggle(personId: string) {
    setSharedBy((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    try {
      await addExpense.mutateAsync({
        amount: Number(amount),
        description,
        paidBy: paidBy!,
        memberIds: sharedBy,
      });
      navigate('/money');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    }
  }

  return (
    <div className="centered wide">
      <header className="rise rise-1">
        <p className="tag">New expense</p>
        <h1 className="wordmark">What did it cost?</h1>
      </header>

      <form className="panel stack-lg rise rise-2" onSubmit={onSubmit}>
        {error && <p className="notice notice-bad">{error}</p>}

        <label className="field">
          <span className="tag">Amount</span>
          <div className="amount-field">
            <span className="amount-sign figure">$</span>
            <input
              className="input amount-input figure"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              required
            />
          </div>
        </label>

        <label className="field">
          <span className="tag">What for</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Costco run"
          />
        </label>

        <p className="tag">Who paid</p>
        <div className="cover-choices" style={{ marginBottom: 20 }}>
          {house.data?.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`btn btn-quiet${paidBy === person.id ? ' is-on' : ''}`}
              onClick={() => setPaidBy(person.id)}
            >
              {person.display_name}
            </button>
          ))}
        </div>

        <p className="tag">Split between {sharedBy.length}</p>
        <div className="cover-choices" style={{ marginBottom: 16 }}>
          {house.data?.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`btn btn-quiet${sharedBy.includes(person.id) ? ' is-on' : ''}`}
              onClick={() => toggle(person.id)}
            >
              {person.display_name}
            </button>
          ))}
        </div>

        {cents > 0 && sharedBy.length > 0 && (
          <p className="readout" style={{ margin: '0 0 20px' }}>
            {sharedBy.length} × {formatMoney(shares[shares.length - 1] / 100)}
            {uneven && <> and {formatMoney(shares[0] / 100)} for the first {shares.filter((s) => s === shares[0]).length}</>}
            {' = '}
            {formatMoney(cents / 100)}
          </p>
        )}

        <button className="btn" type="submit" disabled={!ready || addExpense.isPending}>
          {addExpense.isPending ? 'Saving' : 'Add it'}
        </button>
        <button
          className="btn btn-quiet"
          type="button"
          style={{ marginTop: 10 }}
          onClick={() => navigate('/money')}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
