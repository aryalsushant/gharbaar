import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../lib/auth';

export function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <header className="rise rise-1">
        <p className="tag">घरबार</p>
        <h1 className="wordmark">Gharbaar</h1>
        <p className="lede">Who paid, who cooks, who owes.</p>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Opening the door' : 'Come in'}
        </button>
      </form>

      <p className="rise rise-3" style={{ textAlign: 'center', marginTop: 20, color: 'var(--ink-soft)' }}>
        First time here? <Link className="link" to="/sign-up">Take your seat</Link>
      </p>
    </div>
  );
}
