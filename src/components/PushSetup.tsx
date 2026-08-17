import { useEffect, useState } from 'react';

import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  pushBlockedUntilInstalled,
  pushSupported,
} from '../lib/push';

/**
 * Getting notifications turned on is a real step, not a preference toggle,
 * because on four of the six phones here it requires installing the app first.
 * So this states the requirement rather than failing quietly when the subscribe
 * call is refused.
 */
export function PushSetup({ userId }: { userId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentSubscription()
      .then((sub) => setOn(!!sub))
      .catch(() => setOn(false));
  }, []);

  if (!pushSupported()) return null;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        await enablePush(userId);
        setOn(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (pushBlockedUntilInstalled()) {
    return (
      <section className="panel stack-lg rise rise-4">
        <p className="tag">Reminders on iPhone</p>
        <p className="lede" style={{ maxWidth: 'none' }}>
          Safari only delivers notifications to an app on your home screen, never in a tab.
          Tap Share, then <strong>Add to Home Screen</strong>, and open Gharbaar from the
          icon. The button to turn reminders on appears there.
        </p>
      </section>
    );
  }

  if (on === null) return null;

  return (
    <section className="panel stack-lg rise rise-4">
      <div className="spread">
        <div>
          <p className="tag">Reminders</p>
          <p className="lede" style={{ maxWidth: 'none', margin: 0 }}>
            {on
              ? 'You get a nudge at 5pm on the days you are cooking.'
              : 'A nudge at 5pm on the days you are cooking. Nothing else.'}
          </p>
        </div>
        <button className={on ? 'btn btn-quiet btn-small' : 'btn btn-small'} disabled={busy} onClick={toggle}>
          {busy ? 'Working' : on ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {error && (
        <p className="notice notice-bad" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </p>
      )}

      {!on && isIOS() && (
        <p className="tag" style={{ marginTop: 12, letterSpacing: '0.08em' }}>
          Keep the icon on your home screen. Deleting it also deletes the reminders.
        </p>
      )}
    </section>
  );
}
