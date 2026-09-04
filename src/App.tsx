import { Navigate, Route, Routes } from 'react-router-dom';

import { Water } from './components/Water';
import { useAuth } from './lib/auth';
import { useProfile } from './lib/db';
import { AddExpense } from './screens/AddExpense';
import { Enter } from './screens/Enter';
import { Jobs } from './screens/Jobs';
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
