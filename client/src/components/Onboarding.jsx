import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api.js';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function Onboarding() {
  const [state, setState] = useState({
    status: 'loading', // 'loading' | 'ready' | 'error'
    items: [],
    total: 0,
    completed: 0,
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState(''); // read out by screen readers after each change
  const [actionError, setActionError] = useState('');
  const pending = useRef(new Set());

  useEffect(() => {
    document.title = 'Onboarding path – Team hub';
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .onboarding(controller.signal)
      .then((d) =>
        setState({ status: 'ready', items: d.items, total: d.total, completed: d.completed, error: '' })
      )
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState((s) => ({
          ...s,
          status: 'error',
          error: err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
        }));
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState((s) => ({ ...s, status: 'loading' }));
    setAttempt((n) => n + 1);
  }

  async function toggle(item) {
    if (pending.current.has(item.id)) return; // ignore a second click while one is in flight
    pending.current.add(item.id);
    const done = !item.done;
    try {
      const r = await api.setOnboardingDone(item.id, done);
      setState((s) => ({
        ...s,
        items: s.items.map((x) =>
          x.id === item.id
            ? { ...x, done: r.done, completed_at: r.done ? new Date().toISOString() : null }
            : x
        ),
        total: r.total,
        completed: r.completed,
      }));
      setActionError('');
      setMessage(
        `${done ? 'Marked as done' : 'Marked as not done'}: ${item.title}. ${r.completed} of ${r.total} complete.`
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save your progress. Try again.');
    } finally {
      pending.current.delete(item.id);
    }
  }

  const { status, items, total, completed } = state;

  return (
    <>
      <h1>Onboarding path</h1>
      <p className="lede">
        Work through these in order. Tick each one when you have read it, and your progress is saved.
      </p>

      <div className="sr-only" role="status" aria-live="polite">
        {message}
      </div>

      {actionError && (
        <div className="error-summary" role="alert">
          {actionError}
        </div>
      )}

      {status === 'loading' ? (
        <p className="center">Loading…</p>
      ) : status === 'error' ? (
        <div className="error-summary" role="alert">
          {state.error}{' '}
          <button type="button" className="link" onClick={retry}>
            Try again
          </button>
        </div>
      ) : total === 0 ? (
        <div className="empty">
          <h2>Nothing on the path yet</h2>
          <p>An admin can mark resources as part of the onboarding path when adding or editing them.</p>
          <Link to="/">Go to the resources</Link>
        </div>
      ) : (
        <>
          <p id="progress-label" className="progress-text">
            {completed} of {total} complete
          </p>
          <progress max={total} value={completed} aria-labelledby="progress-label" />
          {completed === total && <p className="notice">You have finished the onboarding path.</p>}

          <ol className="list path" aria-label="Onboarding steps">
            {items.map((item) => (
              <li key={item.id} className="card step">
                <div className="check">
                  <input
                    id={`ob-${item.id}`}
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggle(item)}
                  />
                  <label htmlFor={`ob-${item.id}`}>
                    <span className="sr-only">Mark “{item.title}” as </span>Done
                  </label>
                </div>

                <div className="step-body">
                  <h2>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </h2>
                  {item.description && <p className="desc">{item.description}</p>}
                  <p className="byline">
                    {item.category}
                    {item.done && item.completed_at && (
                      <> · Completed on {dateFormat.format(new Date(item.completed_at))}</>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}