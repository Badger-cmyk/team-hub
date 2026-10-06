import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, setToken, ApiError } from '../api.js';
import Field from './Field.jsx';

export default function Register({ onAuth }) {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get('invite') || '';

  // 'checking' while we ask the server about the invite, then 'ready' or 'invalid'.
  const [check, setCheck] = useState(
    invite
      ? { status: 'checking', email: '', error: '' }
      : {
          status: 'invalid',
          email: '',
          error: 'This page needs an invite link. Ask an admin to send you one.',
        }
  );
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const errorRef = useRef(null);

  useEffect(() => {
    document.title = 'Create your account – Team hub';
  }, []);

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    api
      .checkInvite(invite)
      .then((d) => {
        if (!cancelled) setCheck({ status: 'ready', email: d.email, error: '' });
      })
      .catch((err) => {
        if (cancelled) return;
        setCheck({
          status: 'invalid',
          email: '',
          error: err instanceof ApiError ? err.message : 'Could not check your invite. Try again.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [invite]);

  // When an error appears, move focus to it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setFields({});
    setBusy(true);
    try {
      const data = await api.register({ name, email: check.email, password, invite });
      setToken(data.token);
      onAuth(data.user); // the app then redirects from /register to the home page
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

  if (check.status === 'checking') {
    return (
      <main id="main" className="auth">
        <p role="status">Checking your invite…</p>
      </main>
    );
  }

  if (check.status === 'invalid') {
    return (
      <main id="main" className="auth">
        <h1>Invite link problem</h1>
        <div className="error-summary" role="alert">
          {check.error}
        </div>
        <p>
          <Link to="/">Go to the sign-in page</Link>
        </p>
      </main>
    );
  }

  return (
    <main id="main" className="auth">
      <h1>Welcome to Team hub</h1>
      <p className="lede">
        You have been invited. Choose your name and a password to create your account.
      </p>

      <form onSubmit={submit} noValidate aria-labelledby="register-title">
        <h2 id="register-title">Create your account</h2>

        {error && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}

        <Field id="name" label="Name" error={fields.name}>
          {(p) => (
            <input
              {...p}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Field
          id="email"
          label="Email"
          hint="This is the address your invite was made for. It cannot be changed."
          error={fields.email}
        >
          {(p) => <input {...p} type="email" autoComplete="email" value={check.email} readOnly />}
        </Field>

        <Field id="password" label="Password" hint="Use at least 8 characters." error={fields.password}>
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : 'Create account'}
        </button>
      </form>

      <p className="switch">
        Already have an account? <Link to="/">Sign in</Link>
      </p>
    </main>
  );
}