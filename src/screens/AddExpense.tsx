import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { useAuth } from '../lib/auth';
import { formatMoney, splitEqually, toCents } from '../lib/balances';
import { APARTMENTS, CATEGORIES, categoryOf } from '../lib/categories';
import { useAddExpense, useDeleteExpense, useEditExpense, useExpense, useHousehold } from '../lib/db';

/**
 * One form, two jobs. Adding and correcting an expense ask exactly the same
 * questions, and a separate edit screen would be the same fields drifting out
 * of step with these ones.
 */
export function AddExpense() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { userId } = useAuth();
  const house = useHousehold();
  const addExpense = useAddExpense();
  const editExpense = useEditExpense();
  const removeExpense = useDeleteExpense();
  const existing = useExpense(id);

  const editing = !!id;
  const [loaded, setLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [category, setCategory] = useState('grocery');
  const [apartment, setApartment] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [sharedBy, setSharedBy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chosen = categoryOf(category)!;
  const everyone = useMemo(() => house.data ?? [], [house.data]);

  useEffect(() => {
    setPaidBy((current) => current ?? userId);
  }, [userId]);

  // Fill the form from the row being corrected, once.
  useEffect(() => {
    if (!editing || loaded || !existing.data) return;
    const { expense, sharedBy: shared } = existing.data;
    setCategory(expense.category ?? 'misc');
    setApartment(expense.apartment);
    setAmount(String(expense.amount));
    setDescription(expense.description);
    setPaidBy(expense.paid_by);
    setSharedBy(shared);
    setLoaded(true);
  }, [editing, loaded, existing.data]);

  /**
   * Who shares this follows from the category, and is recomputed whenever it
   * changes. Leaving a stale selection behind is how a flat's internet bill
   * ends up split six ways: the person picked Internet, chose F7, and the four
   * names from the previous grocery run were still ticked.
   */
  useEffect(() => {
    if (everyone.length === 0) return;
    // While an existing expense is still loading, leave the selection alone or
    // it overwrites what we are about to read back.
    if (editing && !loaded) return;
    if (!chosen.perApartment) {
      setSharedBy(everyone.map((p) => p.id));
      setApartment(null);
      return;
    }
    setSharedBy(
      apartment ? everyone.filter((p) => p.apartment === apartment).map((p) => p.id) : []
    );
  }, [chosen.perApartment, apartment, everyone, editing, loaded]);

  const cents = toCents(Number(amount) || 0);

  const shares = useMemo(
    () => (sharedBy.length ? splitEqually(cents, sharedBy.length) : []),
    [cents, sharedBy.length]
  );

  const uneven = shares.length > 1 && shares[0] !== shares[shares.length - 1];
  const needsApartment = chosen.perApartment && !apartment;
  const ready = cents > 0 && sharedBy.length > 0 && !!paidBy && !needsApartment;

  function toggle(personId: string) {
    setSharedBy((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    try {
      if (editing) {
        await editExpense.mutateAsync({
          id: id!,
          amount: Number(amount),
          description,
          paidBy: paidBy!,
          memberIds: sharedBy,
          category,
          apartment,
        });
      } else {
        await addExpense.mutateAsync({
          amount: Number(amount),
          description,
          paidBy: paidBy!,
          memberIds: sharedBy,
          category,
          apartment,
        });
      }
      navigate('/money');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    }
  }

  return (
    <div className="centered wide">
      <header className="rise rise-1">
        <p className="tag">{editing ? 'Correcting' : 'New expense'}</p>
        <h1 className="wordmark">{editing ? 'Fix it' : 'What did it cost?'}</h1>
      </header>

      <form className="panel stack-lg rise rise-2" onSubmit={onSubmit}>
        {error && <p className="notice notice-bad">{error}</p>}

        <p className="tag">What kind</p>
        <div className="chips" style={{ marginBottom: 18 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip${category === c.key ? ' is-on' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {chosen.perApartment && (
          <>
            <p className="tag">Which apartment</p>
            <div className="chips" style={{ marginBottom: 18 }}>
              {APARTMENTS.map((flat) => (
                <button
                  key={flat}
                  type="button"
                  className={`chip${apartment === flat ? ' is-on' : ''}`}
                  onClick={() => setApartment(flat)}
                >
                  {flat}
                </button>
              ))}
            </div>
          </>
        )}

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
            placeholder={chosen.placeholder}
          />
        </label>

        <p className="tag">Who paid</p>
        <div className="chips" style={{ marginBottom: 20 }}>
          {everyone.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`chip chip-face${paidBy === person.id ? ' is-on' : ''}`}
              onClick={() => setPaidBy(person.id)}
            >
              <Avatar
                rosterKey={person.roster_key}
                name={person.display_name}
                url={person.avatar_url}
                size={22}
              />
              {person.display_name}
            </button>
          ))}
        </div>

        <p className="tag">
          {needsApartment ? 'Pick an apartment first' : `Split between ${sharedBy.length}`}
        </p>
        <div className="chips" style={{ marginBottom: 16 }}>
          {everyone.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`chip chip-face${sharedBy.includes(person.id) ? ' is-on' : ''}`}
              onClick={() => toggle(person.id)}
            >
              <Avatar
                rosterKey={person.roster_key}
                name={person.display_name}
                url={person.avatar_url}
                size={22}
              />
              {person.display_name}
            </button>
          ))}
        </div>

        {cents > 0 && sharedBy.length > 0 && (
          <p className="readout" style={{ margin: '0 0 20px' }}>
            {sharedBy.length} × {formatMoney(shares[shares.length - 1] / 100)}
            {uneven && (
              <>
                {' '}
                and {formatMoney(shares[0] / 100)} for the first{' '}
                {shares.filter((s) => s === shares[0]).length}
              </>
            )}
            {' = '}
            {formatMoney(cents / 100)}
          </p>
        )}

        <button
          className="btn"
          type="submit"
          disabled={!ready || addExpense.isPending || editExpense.isPending}
        >
          {addExpense.isPending || editExpense.isPending
            ? 'Saving'
            : editing
              ? 'Save changes'
              : 'Add it'}
        </button>
        <button
          className="btn btn-quiet"
          type="button"
          style={{ marginTop: 10 }}
          onClick={() => navigate('/money')}
        >
          Cancel
        </button>

        {editing && (
          <div className="footer-row" style={{ marginTop: 18 }}>
            {confirmingDelete ? (
              <>
                <span className="tag">Removing it changes what everyone owes.</span>
                <button
                  type="button"
                  className="link link-danger"
                  disabled={removeExpense.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await removeExpense.mutateAsync(id!);
                      navigate('/money');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not remove it.');
                    }
                  }}
                >
                  Yes, delete it
                </button>
                <button type="button" className="link" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                className="link link-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete this expense
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
