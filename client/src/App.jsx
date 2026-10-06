import { useCallback, useEffect, useState } from 'react';
import { api, setToken, hasToken, setUnauthorizedHandler } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import Hub from './components/Hub.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(hasToken());

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // On first load, check whether a saved token still works.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!hasToken()) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [signOut]);

  if (booting) {
    return (
      <main>
        <p role="status">Loading…</p>
      </main>
    );
  }

  if (!user) return <AuthForm onAuth={setUser} />;

  // Temporary: the resource list replaces this in the next step.
  return <Hub user={user} onSignOut={signOut} />
}