import { Link, NavLink } from 'react-router-dom';

import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/db';

/**
 * Tonight, the list, the money, the people, and you.
 *
 * Your own face sits apart from the tabs on purpose. The tabs are places in the
 * house; your face is who you are while standing in them, and it belongs in the
 * same corner of every screen so it can be reached without looking for it.
 */
export function Nav() {
  const { userId } = useAuth();
  const me = useProfile(userId);

  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link is-on' : 'nav-link');

  return (
    <div className="topbar rise rise-1">
      <nav className="nav">
        <NavLink to="/today" className={tab}>
          Tonight
        </NavLink>
        <NavLink to="/list" className={tab}>
          List
        </NavLink>
        <NavLink to="/money" className={tab}>
          Money
        </NavLink>
        <NavLink to="/house" className={tab}>
          House
        </NavLink>
      </nav>

      {me.data && (
        <Link
          to={`/house/${me.data.id}`}
          className="me"
          aria-label={`${me.data.display_name}, your details`}
          title="Your details"
        >
          <Avatar
            rosterKey={me.data.roster_key}
            name={me.data.display_name}
            url={me.data.avatar_url}
            size={38}
          />
        </Link>
      )}
    </div>
  );
}
