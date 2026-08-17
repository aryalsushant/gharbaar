import { useState, type FormEvent } from 'react';

import { Avatar } from '../components/Avatar';
import { useAuth } from '../lib/auth';
import { useClaimIdentity, usePublicRoster } from '../lib/db';

type Step = 'tiles' | 'email' | 'code';

/**
 * The whole way in, in one screen: six faces, your email, a code.
 *
 * The tiles come first because that is the question a housemate can answer
 * without thinking. Asking for an email before showing them anything is asking
 * them to prove who they are before telling them where they are.
 *
 * The seat is only claimed after the code is verified, and the binding is
 * checked in the database rather than here. Tapping the wrong tile is caught,
 * but only once you have proved which inbox is yours, so this never becomes a
 * way to test whether a guessed address belongs to a particular person.
 */
export function Enter() {
  const { session, sendCode, verifyCode } = useAuth();
  const roster = usePublicRoster();
  const claim = useClaimIdentity();

  const [step, setStep] = useState<Step>('tiles');
  const [seat, setSeat] = useState<{ key: string; display_name: string } | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(chosen: { key: string; display_name: string }) {
    setError(null);
    setSeat(chosen);

    // Already signed in and just taking a seat: no need to prove the inbox
    // twice. The binding check still runs inside claim_identity.
    if (session) {
      setBusy(true);
      try {
        await claim.mutateAsync(chosen.key);
      } catch (err) {
        setError(readable(err));
        setSeat(null);
      } finally {
        setBusy(false);
      }
      return;
    }

    setStep('email');
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendCode(email);
      setStep('code');
    } catch (err) {
      setError(readable(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyCode(email, code);
      await claim.mutateAsync(seat!.key);
      // The session change re-renders the app past this screen.
    } catch (err) {
      setError(readable(err));
    } finally {
      setBusy(false);
    }
  }

  if (roster.isLoading) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">घरबार</p>
      </div>
    );
  }

  if (step === 'email' && seat) {
    return (
      <div className="centered">
        <header className="rise rise-1">
          <div className="claim-face">
            <Avatar rosterKey={seat.key} name={seat.display_name} size={96} />
          </div>
          <p className="tag">Hello {seat.display_name}</p>
          <h1 className="wordmark">Your email</h1>
          <p className="lede">We send a six digit code. No password, ever.</p>
        </header>

        <form className="panel stack-lg rise rise-2" onSubmit={submitEmail}>
          {error && <p className="notice notice-bad">{error}</p>}

          <label className="field">
            <span className="tag">Email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              required
            />
          </label>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Sending' : 'Send the code'}
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep('tiles');
              setSeat(null);
              setError(null);
            }}
          >
            Not {seat.display_name}
          </button>
        </form>
      </div>
    );
  }

  if (step === 'code' && seat) {
    return (
      <div className="centered">
        <header className="rise rise-1">
          <p className="tag">Sent to {email}</p>
          <h1 className="wordmark">Six digits</h1>
          <p className="lede">Check your inbox. It usually lands in seconds.</p>
        </header>

        <form className="panel stack-lg rise rise-2" onSubmit={submitCode}>
          {error && <p className="notice notice-bad">{error}</p>}

          <label className="field">
            <span className="tag">Code</span>
            <input
              className="input code-input figure"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
            />
          </label>

          <button className="btn" type="submit" disabled={busy || code.length < 6}>
            {busy ? 'Letting you in' : 'Let me in'}
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Wrong address
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="centered">
      <header className="rise rise-1">
        <p className="tag">घरबार</p>
        <h1 className="wordmark">Gharbaar</h1>
        <p className="lede">Which one are you?</p>
      </header>

      {error && <p className="notice notice-bad rise rise-2">{error}</p>}

      <div className="seats stack-lg rise rise-2">
        {roster.data?.map((entry, i) => (
          <button
            key={entry.key}
            className="seat"
            disabled={busy}
            onClick={() => pick(entry)}
            style={{ animationDelay: `${0.18 + i * 0.07}s` }}
          >
            <Avatar rosterKey={entry.key} name={entry.display_name} size={44} />
            <span className="seat-name">{entry.display_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Postgres error codes are not sentences. */
function readable(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/different email address/i.test(message)) {
    return 'That is somebody else\'s seat. It is reserved for a different address.';
  }
  if (/already taken/i.test(message)) {
    return 'Somebody has already taken that one.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many codes requested. Wait a minute and try again.';
  }
  if (/expired|invalid/i.test(message)) {
    return 'That code did not work. It may have expired, so ask for another.';
  }
  return message;
}
