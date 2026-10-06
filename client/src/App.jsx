import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { api, setToken, hasToken, setUnauthorizedHandler } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import Hub from './components/Hub.jsx';
import Invites from './components/Invites.jsx';
import Layout from './components/Layout.jsx';
import Onboarding from './components/Onboarding.jsx';
import Register from './components/Register.jsx';

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found – Team hub';
  }, []);
  return (
    <>
      <h1>Page not found</h1>
      <p>
        That page does not exist. <Link to="/">Go to the resources</Link>.
      </p>
    </>
  );
}

function NoAccess() {
  useEffect(() => {
    document.title = 'No access – Team hub';
  }, []);
  return (
    <>
      <h1>No access</h1>
      <p>
        Only admins can use this page. <Link to="/">Go to the resources</Link>.
      </p>
    </>
  );
}

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
      // A 401 is handled by the handler above, which clears the token.
      // Other failures (server down) keep the token so a later refresh still works.
      .catch(() => {})
      .finally(() => setBooting(false));
  }, [signOut]);

  if (booting) {
    return (
      <main>
        <p role="status">Loading…</p>
      </main>
    );
  }

  // Signed out: the registration page (reached from an invite link) or the sign-in form.
  if (!user) {
    return (
      <Routes>
        <Route path="register" element={<Register onAuth={setUser} />} />
        <Route path="*" element={<AuthForm onAuth={setUser} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Someone who is already signed in has no use for an invite link. */}
      <Route path="register" element={<Navigate to="/" replace />} />
      <Route element={<Layout user={user} onSignOut={signOut} />}>
        <Route index element={<Hub user={user} />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="invites" element={user.role === 'admin' ? <Invites /> : <NoAccess />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}