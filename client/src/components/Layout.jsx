import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function Layout({ user, onSignOut }) {
  const location = useLocation();
  const mainRef = useRef(null);
  const previousPath = useRef(location.pathname);

  // A single-page app doesn't reload when you change page, so screen readers hear nothing.
  // After moving to a different page, put focus at the top of the new content.
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      mainRef.current?.focus();
    }
  }, [location.pathname]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        <p className="brand">Team hub</p>

        <nav aria-label="Main">
          <ul className="nav">
            <li>
              <NavLink to="/" end>
                Resources
              </NavLink>
            </li>
            <li>
              <NavLink to="/onboarding">Onboarding path</NavLink>
            </li>
            {user.role === 'admin' && (
                <li>
                    <NavLink to="/invites">Invite People</NavLink>
                </li>
            )}
          </ul>
        </nav>

        <div className="who">
          <span>Signed in as {user.name}</span>
          <button type="button" className="btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
    </>
  );
}