import { useState, type FormEvent } from 'react';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import {
  useAddGroceryItem,
  useGroceryItems,
  useHousehold,
  useRemoveGroceryItem,
  useToggleGroceryItem,
} from '../lib/db';

/**
 * What the house needs.
 *
 * No pictures. Every item is set in the display face at a size that scales with
 * how long the word is, so the list reads as a hand-written note rather than a
 * table: short words like "rice" come out large and confident, longer ones
 * settle down. It gives a plain list of nouns a shape without decorating it.
 *
 * Ticking something off strikes it through with a line that draws across rather
 * than appearing, which is the one moment in the app worth animating: it is the
 * gesture people repeat twenty times while standing in a shop.
 */
export function List() {
  const { userId } = useAuth();
  const items = useGroceryItems();
  const house = useHousehold();
  const add = useAddGroceryItem();
  const toggle = useToggleGroceryItem();
  const remove = useRemoveGroceryItem();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const personOf = (id: string) => house.data?.find((p) => p.id === id);
  const wanted = (items.data ?? []).filter((i) => !i.in_basket);
  const basket = (items.data ?? []).filter((i) => i.in_basket);

  /** Short words get to shout. Long ones cannot without wrapping badly. */
  const sizeFor = (text: string) => {
    const n = text.trim().length;
    if (n <= 5) return 'is-xl';
    if (n <= 10) return 'is-lg';
    if (n <= 18) return 'is-md';
    return 'is-sm';
  };

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value || !userId) return;
    setError(null);
    setName('');
    try {
      await add.mutateAsync({ name: value, addedBy: userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that.');
      setName(value);
    }
  }

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">
          {wanted.length === 0 && basket.length === 0
            ? 'Nothing needed'
            : `${wanted.length} to get${basket.length ? ` · ${basket.length} in the basket` : ''}`}
        </p>
        <h1 className="wordmark">The list</h1>
      </header>

      <form className="list-add stack-lg rise rise-2" onSubmit={onAdd}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chicken, tomatoes, onions"
          aria-label="What do we need"
        />
        <button className="btn btn-small" type="submit" disabled={!name.trim() || add.isPending}>
          Add
        </button>
      </form>

      {error && <p className="notice notice-bad rise rise-2">{error}</p>}

      {wanted.length === 0 && basket.length === 0 ? (
        <p className="lede rise rise-3" style={{ marginTop: 26 }}>
          Add what the house is out of. Anyone can add, anyone can tick things off in the
          shop, and it updates on everybody's phone while you are standing there.
        </p>
      ) : (
        <ul className="list-items stack-lg rise rise-3">
          {[...wanted, ...basket].map((item, i) => {
            const who = personOf(item.added_by);
            return (
              <li key={item.id}>
                <button
                  className={`list-item ${sizeFor(item.name)}${item.in_basket ? ' is-got' : ''}`}
                  onClick={() => toggle.mutate({ id: item.id, inBasket: !item.in_basket })}
                  style={{ animationDelay: `${0.16 + i * 0.03}s` }}
                >
                  <span className="list-name">
                    {item.name}
                    <span className="list-strike" aria-hidden="true" />
                  </span>
                </button>

                <span className="list-meta">
                  <Avatar
                    rosterKey={who?.roster_key ?? null}
                    name={who?.display_name ?? 'Someone'}
                    url={who?.avatar_url}
                    size={20}
                  />
                  <button
                    className="link list-remove"
                    onClick={() => remove.mutate(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {basket.length > 0 && (
        <p className="tag rise rise-4" style={{ marginTop: 22, letterSpacing: '0.08em' }}>
          Log the shop on the Money tab when you are done. Ticked items clear themselves
          once it is saved.
        </p>
      )}
    </div>
  );
}
