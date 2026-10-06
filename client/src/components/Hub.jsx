import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';
import ResourceCard from './ResourceCard.jsx';

export default function Hub({ user, onSignOut }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Changing this number makes the effect below run again (used by "Try again").
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .list({}, controller.signal)
      .then((data) => {
        setResources(data.resources);
        setLoadError('');
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return; // a newer request replaced this one
        setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  // Called from a click, not from an effect, so setting state here is fine.
  function reload() {
    setLoading(true);
    setLoadError('');
    setAttempt((n) => n + 1);
  }

  // Read out by screen readers when the list changes, without moving focus.
  const announcement =
    loading || loadError
      ? ''
      : `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'} found`;

  return (
    <>
      <a className="skip" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        <p className="brand">Team hub</p>
        <div className="who">
          <span>Signed in as {user.name}</span>
          <button type="button" className="btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <h1>Resources</h1>

        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {loadError ? (
          <div className="error-summary" role="alert">
            {loadError}{' '}
            <button type="button" className="link" onClick={reload}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <p className="center">Loading resources…</p>
        ) : resources.length === 0 ? (
          <div className="empty">
            <h2>Start the library</h2>
            <p>Nothing has been shared yet.</p>
          </div>
        ) : (
          <ul className="list" aria-label="Resources">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}