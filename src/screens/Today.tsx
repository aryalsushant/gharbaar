import { useAuth } from '../lib/auth';
import { useHousehold, useProfile } from '../lib/db';
import { toDateKey } from '../lib/rotation';

/**
 * Placeholder for the duty board. It exists so the third gate in App.tsx has
 * somewhere real to land, and so claiming a seat can be verified end to end.
 */
export function Today() {
  const { userId, signOut } = useAuth();
  const me = useProfile(userId);
  const house = useHousehold();

  const today = toDateKey(new Date());

  return (
    <div className="centered">
      <header className="rise rise-1">
        <p className="tag figure">{today}</p>
        <h1 className="wordmark">Evening, {me.data?.display_name}</h1>
        <p className="lede">The board goes here next: tonight's cook, the ledger, the fines.</p>
      </header>

      <section className="panel stack-lg rise rise-2">
        <p className="tag">In the house</p>
        <ul className="roster-list">
          {house.data?.map((person) => (
            <li key={person.id}>
              <span>{person.display_name}</span>
              <span className="tag figure">{person.date_of_birth ?? '—'}</span>
            </li>
          ))}
        </ul>
        {house.data?.length === 1 && (
          <p className="lede" style={{ maxWidth: 'none' }}>
            Just you so far. Send the others the link and they can take their seats.
          </p>
        )}
      </section>

      <p className="rise rise-3" style={{ textAlign: 'center', marginTop: 22, color: 'var(--ink-soft)' }}>
        <button className="link" onClick={() => signOut()}>Sign out</button>
      </p>
    </div>
  );
}
