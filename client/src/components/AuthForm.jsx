import { useEffect, useRef, useState } from 'react';
import { api, setToken, ApiError } from '../api.js';
import Field from './Field.jsx';

export default function AuthForm({ onAuth }) {
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const errorRef = useRef(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  useEffect(() => {
    document.title = 'Sign in – Team hub';
  }, []);

  // When an error appears, move focus to it so keyboard and screen reader users notice.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setFields({});
    setBusy(true);
    try {
      const data = await api.login(values);
      setToken(data.token);
      onAuth(data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields || {});
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="auth">
      <h1>Team hub</h1>
      <p className="lede">Sign in to find and share resources.</p>

      <form onSubmit={submit} noValidate aria-labelledby="auth-title">
        <h2 id="auth-title">Sign in</h2>

        {error && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}

        <Field id="email" label="Email" error={fields.email}>
          {(p) => (
            <input {...p} type="email" autoComplete="email" value={values.email} onChange={set('email')} />
          )}
        </Field>
        <Field id="password" label="Password" error={fields.password}>
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={set('password')}
            />
          )}
        </Field>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : 'Sign in'}
        </button>
      </form>

      <p className="switch">Need access? Ask an admin for an invite link.</p>
    </main>
  );
}