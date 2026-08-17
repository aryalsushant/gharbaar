import { NavLink } from 'react-router-dom';

/**
 * Two halves of the house, and only two. A household app that grows a five tab
 * bar has stopped being about the household.
 */
export function Nav() {
  return (
    <nav className="nav rise rise-1">
      <NavLink to="/today" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        Tonight
      </NavLink>
      <NavLink to="/money" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        Money
      </NavLink>
    </nav>
  );
}
