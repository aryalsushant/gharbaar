import { Navigate, Route, Routes } from 'react-router-dom';

import { Water } from './components/Water';
import { useAuth } from './lib/auth';
import { useProfile } from './lib/db';
import { Enter } from './screens/Enter';
import { Jobs } from './screens/Jobs';
import { List } from './screens/List';
import { People } from './screens/People';
import { Person } from './screens/Person';
import { Stats } from './screens/Stats';
import { Today } from './screens/Today';

/**
 * One gate, not three. Either you hold a seat and see the house, or you are on
 * the way in: tiles, email, code.
 *
 * Holding a seat is the whole of membership. Row level security keys off it, so
 * an account without one can read nothing at all, and sending it anywhere but
 * the entrance would render an empty app.
 */
export default function App() {
  const { userId, loading } = useAuth();
  const profile = useProfile(userId);

  const booting = loading || (!!userId && profile.isLoading);

  return (
    <>
      <Water />
      <div className="stage">
        {booting ? (
          <div className="centered">
            <p className="tag rise rise-1">Gharbaar</p>
          </div>
        ) : !userId || !profile.data?.roster_key ? (
          <Enter />
        ) : (
          <Routes>
            <Route path="/today" element={<Today />} />
            <Route path="/list" element={<List />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/house" element={<People />} />
            <Route path="/house/:id" element={<Person />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        )}
      </div>
    </>
  );
}
