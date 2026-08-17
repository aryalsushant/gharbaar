import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../lib/auth';

/**
 * Deliberately instrumented. Every rule the form enforces is visible as a live
 * readout rather than hidden until submit, so the screen feels like a panel
 * responding to you instead of a form judging you afterwards.
 */
export function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(
    () => [
      { label: 'address looks real', ok: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) },
      { label: 'at least 8 characters', ok: password.length >= 8 },
      { label: 'both entries agree', ok: password.length > 0 && password === confirm },
    ],
    [email, password, confirm]
  );

  const ready = checks.every((c) => c.ok);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="centered">
        <div className="panel rise rise-1">
          <p className="tag">Check your inbox</p>
          <h2>One more tap</h2>
          <p className="lede" style={{ maxWidth: 'none' }}>
            We sent a confirmation link to <span className="figure">{email.trim()}</span>. Open it,
            then come back and sign in to pick your seat at the table.
          </p>
          <Link className="btn btn-quiet" to="/sign-in" style={{ display: 'block', marginTop: 20, textAlign: 'center', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="centered">
      <header className="rise rise-1">
        <p className="tag">घरबार · six seats</p>
        <h1 className="wordmark">Take a seat</h1>
        <p className="lede">An account first. Your name comes next.</p>
      </header>

      <form className="panel stack-lg rise rise-2" onSubmit={onSubmit}>
        {error && <p className="notice notice-bad">{error}</p>}

        <label className="field">
          <span className="tag">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span className="tag">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <label className="field">
          <span className="tag">Again</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <ul className="readout">
          {checks.map((check) => (
            <li key={check.label} className={check.ok ? 'met' : undefined}>
              <span className="mark">{check.ok ? '✓' : '·'}</span>
              {check.label}
            </li>
          ))}
        </ul>

        <button className="btn" type="submit" disabled={!ready || busy}>
          {busy ? 'Setting a place' : 'Create account'}
        </button>
      </form>

      <p className="rise rise-3" style={{ textAlign: 'center', marginTop: 20, color: 'var(--ink-soft)' }}>
        Already have one? <Link className="link" to="/sign-in">Sign in</Link>
      </p>
    </div>
  );
}
