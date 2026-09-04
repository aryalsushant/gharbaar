import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Splash } from './components/Splash';
import { Water } from './components/Water';
import { useAuth } from './lib/auth';
import { useProfile } from './lib/db';
import { AddExpense } from './screens/AddExpense';
import { Enter } from './screens/Enter';
import { List } from './screens/List';
import { Money } from './screens/Money';
import { People } from './screens/People';
import { Person } from './screens/Person';
import { Today } from './screens/Today';

/**
 * One gate, not three. Either you hold a seat and see the house, or you are on
 * the way in: tiles, email, code.
 *
 * Holding a seat is the whole of membership. Row level security keys off it, so
 * an account without one can read nothing at all, and sending it anywhere but
 * the entrance would render an empty app.
 */
/**
 * How long the app has to be out of sight before opening it counts as opening
 * it again.
 *
 * Six people asked to see the splash every time they open the app, and every
 * launch already did. This covers the other half: coming back after a while,
 * where the page never reloaded and React never remounted. A minute is long
 * enough that glancing at a message and returning does not replay it, and short
 * enough that picking the phone up after dinner does.
 */
const AWAY_MS = 60_000;

export default function App() {
  const [splashing, setSplashing] = useState(true);
  const { session, userId, loading } = useAuth();
  const profile = useProfile(userId);

  const booting = loading || (!!userId && profile.isLoading);

  const dismissSplash = useCallback(() => setSplashing(false), []);

  // Coming back after being away is opening the app, even when the page never
  // reloaded.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) setSplashing(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <>
      <Water />
      {splashing && <Splash onDone={dismissSplash} person={profile.data ?? undefined} />}
      <div className="stage">
        {booting ? (
          <div className="centered">
            <p className="tag rise rise-1">Gharbaar</p>
          </div>
        ) : !session || !profile.data?.roster_key ? (
          <Enter />
        ) : (
          <Routes>
            <Route path="/today" element={<Today />} />
            <Route path="/list" element={<List />} />
            <Route path="/money" element={<Money />} />
            <Route path="/money/add" element={<AddExpense />} />
            <Route path="/money/:id/edit" element={<AddExpense />} />
            <Route path="/house" element={<People />} />
            <Route path="/house/:id" element={<Person />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        )}
      </div>
    </>
  );
}
