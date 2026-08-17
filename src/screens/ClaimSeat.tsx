import { useState, type FormEvent } from 'react';

import { Avatar } from '../components/Avatar';
import { useAuth } from '../lib/auth';
import { useClaimIdentity, useRoster } from '../lib/db';

/**
 * Six seats, one each. Names come from the database rather than a client
 * constant so two people cannot both claim Suwan even if they tap at the same
 * moment: the unique constraint on profiles.roster_key settles it.
 */
export function ClaimSeat() {
  const { signOut } = useAuth();
  const roster = useRoster();
  const claim = useClaimIdentity();

  const [picked, setPicked] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);

  const chosen = roster.data?.find((r) => r.key === picked);

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    if (!picked || !dob) return;
    setError(null);
    try {
      await claim.mutateAsync({ key: picked, dateOfBirth: dob });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take that seat.');
      setPicked(null);
    }
  }

  if (roster.isLoading) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">Setting the table</p>
      </div>
    );
  }

  if (roster.error) {
    return (
      <div className="centered">
        <div className="panel rise rise-1">
          <p className="notice notice-bad">{(roster.error as Error).message}</p>
          <button className="btn btn-quiet" onClick={() => roster.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (chosen) {
    return (
      <div className="centered">
        <header className="rise rise-1">
          <p className="tag">Confirm</p>
          <div className="claim-face">
            <Avatar rosterKey={chosen.key} name={chosen.display_name} size={96} />
          </div>
          <h1 className="wordmark">{chosen.display_name}?</h1>
          <p className="lede">
            {chosen.email_hint
              ? `This seat is reserved for ${chosen.email_hint}. You can only take it if that is the address you signed in with.`
              : 'Once you take this seat it is yours, so make sure it is you.'}
          </p>
        </header>

        <form className="panel stack-lg rise rise-2" onSubmit={onConfirm}>
          {error && <p className="notice notice-bad">{error}</p>}

          <label className="field">
            <span className="tag">Your date of birth</span>
            <input
              className="input"
              type="date"
              value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </label>
          <p className="tag" style={{ marginTop: -6, marginBottom: 18, letterSpacing: '0.08em' }}>
            Only used so the house gets a heads up before your birthday.
          </p>

          <button className="btn" type="submit" disabled={!dob || claim.isPending}>
            {claim.isPending ? 'Taking your seat' : `Yes, I am ${chosen.display_name}`}
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => setPicked(null)}
          >
            That is not me
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="centered">
      <header className="rise rise-1">
        <p className="tag">घरबार</p>
        <h1 className="wordmark">Which one are you?</h1>
        <p className="lede">Six seats in this house. Pick yours.</p>
      </header>

      <div className="seats stack-lg rise rise-2">
        {roster.data?.map((seat, i) => (
          <button
            key={seat.key}
            className="seat"
            disabled={seat.claimed}
            onClick={() => setPicked(seat.key)}
            style={{ animationDelay: `${0.2 + i * 0.07}s` }}
          >
            <Avatar rosterKey={seat.key} name={seat.display_name} size={40} />
            <span className="seat-name">{seat.display_name}</span>
            <span className="tag">
              {seat.claimed ? 'taken' : (seat.email_hint ?? 'free')}
            </span>
          </button>
        ))}
      </div>

      <p className="rise rise-5" style={{ textAlign: 'center', marginTop: 22, color: 'var(--ink-soft)' }}>
        Wrong account? <button className="link" onClick={() => signOut()}>Sign out</button>
      </p>
    </div>
  );
}
