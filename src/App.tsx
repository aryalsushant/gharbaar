import { Navigate, Route, Routes } from 'react-router-dom';

import { Water } from './components/Water';
import { useAuth } from './lib/auth';
import { useProfile } from './lib/db';
import { AddExpense } from './screens/AddExpense';
import { ClaimSeat } from './screens/ClaimSeat';
import { Money } from './screens/Money';
import { People } from './screens/People';
import { Person } from './screens/Person';
import { SignIn } from './screens/SignIn';
import { SignUp } from './screens/SignUp';
import { Today } from './screens/Today';

/**
 * Three gates, in order:
 *   no session            -> sign in
 *   session, no seat      -> claim one of the six
 *   session with a seat   -> the house
 *
 * The middle gate matters more than it looks. Row level security keys off
 * whether a profile has claimed a roster seat, so an account that skipped it
 * can read nothing at all. Sending them anywhere else would just render empty.
 */
export default function App() {
  const { session, userId, loading } = useAuth();
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
        ) : !session ? (
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="*" element={<Navigate to="/sign-in" replace />} />
          </Routes>
        ) : !profile.data?.roster_key ? (
          <Routes>
            <Route path="/claim" element={<ClaimSeat />} />
            <Route path="*" element={<Navigate to="/claim" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/today" element={<Today />} />
            <Route path="/money" element={<Money />} />
            <Route path="/money/add" element={<AddExpense />} />
            <Route path="/house" element={<People />} />
            <Route path="/house/:id" element={<Person />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        )}
      </div>
    </>
  );
}
