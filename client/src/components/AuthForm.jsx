import { useEffect, useRef, useState } from 'react';
import { api, setToken, ApiError } from '../api.js';
import Field from './Field.jsx';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const errorRef = useRef(null);

  const isRegister = mode === 'register';
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

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
      const data = isRegister
        ? await api.register(values)
        : await api.login({ email: values.email, password: values.password });
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

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError('');
    setFields({});
  }

  return (
    <main id="main" className="auth">
      <h1>Team hub</h1>
      <p className="lede">
        {isRegister
          ? 'Create an account to share and find resources.'
          : 'Sign in to find and share resources.'}
      </p>

      <form onSubmit={submit} noValidate aria-labelledby="auth-title">
        <h2 id="auth-title">{isRegister ? 'Create account' : 'Sign in'}</h2>

        {error && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}

        {isRegister && (
          <Field id="name" label="Name" error={fields.name}>
            {(p) => (
              <input {...p} type="text" autoComplete="name" value={values.name} onChange={set('name')} />
            )}
          </Field>
        )}
        <Field id="email" label="Email" error={fields.email}>
          {(p) => (
            <input {...p} type="email" autoComplete="email" value={values.email} onChange={set('email')} />
          )}
        </Field>
        <Field
          id="password"
          label="Password"
          hint={isRegister ? 'Use at least 8 characters.' : undefined}
          error={fields.password}
        >
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={set('password')}
            />
          )}
        </Field>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="switch">
        {isRegister ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" className="link" onClick={switchMode}>
          {isRegister ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </main>
  );
}