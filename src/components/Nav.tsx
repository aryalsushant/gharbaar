import { NavLink } from 'react-router-dom';

/**
 * Tonight, the list, the money, the people.
 *
 * This said three was the ceiling. The list earned the fourth place by being
 * the screen used most often and the only one opened while standing somewhere
 * else, so burying it under Money would have been wrong. Four is the ceiling.
 */
export function Nav() {
  return (
    <nav className="nav rise rise-1">
      <NavLink to="/today" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        Tonight
      </NavLink>
      <NavLink to="/list" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        List
      </NavLink>
      <NavLink to="/money" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        Money
      </NavLink>
      <NavLink to="/house" className={({ isActive }) => (isActive ? 'nav-link is-on' : 'nav-link')}>
        House
      </NavLink>
    </nav>
  );
}
