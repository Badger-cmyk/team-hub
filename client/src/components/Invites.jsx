import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import Field from './Field.jsx';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const formatDate = (value) => dateFormat.format(new Date(value));

const STATUS_LABEL = { pending: 'Pending', used: 'Used', expired: 'Expired' };

function dateText(inv) {
  if (inv.status === 'used') return `Used ${formatDate(inv.used_at)}`;
  if (inv.status === 'expired') return `Expired ${formatDate(inv.expires_at)}`;
  return `Expires ${formatDate(inv.expires_at)}`;
}

export default function Invites() {
  const [state, setState] = useState({ status: 'loading', invites: [], error: '' });
  const [attempt, setAttempt] = useState(0);

  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [newInvite, setNewInvite] = useState(null); // { email, link }, shown once
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(''); // read out by screen readers
  const [actionError, setActionError] = useState('');

  const errorRef = useRef(null);
  const panelRef = useRef(null);
  const linkRef = useRef(null);
  const listHeadingRef = useRef(null);

  useEffect(() => {
    document.title = 'Invite people – Team hub';
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listInvites(controller.signal)
      .then((d) => setState({ status: 'ready', invites: d.invites, error: '' }))
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

  // When an error appears, move focus to it.
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  // When a new link is created, move focus to it so nobody has to hunt for it.
  useEffect(() => {
    if (newInvite) panelRef.current?.focus();
  }, [newInvite]);

  const reload = () => setAttempt((n) => n + 1);

  function retry() {
    setState((s) => ({ ...s, status: 'loading' }));
    reload();
  }

  async function createInvite(e) {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setActionError('');
    setBusy(true);
    try {
      const data = await api.createInvite(email.trim());
      setNewInvite({ email: data.invite.email, link: data.link });
      setCopied(false);
      setEmail('');
      setMessage(`Invite created for ${data.invite.email}. The link is shown below.`);
      reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fields || {});
      } else {
        setFormError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(newInvite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      setMessage('Link copied to the clipboard.');
    } catch {
      linkRef.current?.select();
      setMessage('Could not copy automatically. The link is selected, so press Control and C to copy it.');
    }
  }

  async function revoke(inv) {
    setActionError('');
    try {
      await api.revokeInvite(inv.id);
      setState((s) => ({ ...s, invites: s.invites.filter((x) => x.id !== inv.id) }));
      if (newInvite?.email === inv.email) setNewInvite(null);
      setMessage(`Removed the invite for ${inv.email}.`);
      // The row the person was on is gone, so move focus to the list heading.
      listHeadingRef.current?.focus();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not remove the invite. Try again.');
    }
  }

  const { status, invites } = state;

  return (
    <>
      <h1>Invite people</h1>
      <p className="lede">
        Enter the email of the person you want to invite. You will get a link to send them. The link
        works once and expires after 7 days.
      </p>

      <section className="card form-card" aria-labelledby="new-invite-title">
        <h2 id="new-invite-title">Create an invite</h2>
        <form onSubmit={createInvite} noValidate>
          {formError && (
            <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
              {formError}
            </div>
          )}
          <Field id="invite-email" label="Email of the person you are inviting" error={fieldErrors.email}>
            {(p) => (
              <input
                {...p}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create invite link'}
          </button>
        </form>
      </section>

      {newInvite && (
        <section className="card form-card" aria-labelledby="new-link-title">
          <h2 id="new-link-title" tabIndex={-1} ref={panelRef}>
            Invite link for {newInvite.email}
          </h2>
          <p className="hint">
            Copy this link now and send it to them. For safety it is shown only once.
          </p>
          <div className="field">
            <label htmlFor="invite-link">Invite link</label>
            <div className="link-row">
              <input
                id="invite-link"
                ref={linkRef}
                type="text"
                readOnly
                value={newInvite.link}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {message}
      </div>

      {actionError && (
        <div className="error-summary" role="alert">
          {actionError}
        </div>
      )}

      <h2 tabIndex={-1} ref={listHeadingRef}>
        Invites
      </h2>

      {status === 'loading' ? (
        <p className="center">Loading…</p>
      ) : status === 'error' ? (
        <div className="error-summary" role="alert">
          {state.error}{' '}
          <button type="button" className="link" onClick={retry}>
            Try again
          </button>
        </div>
      ) : invites.length === 0 ? (
        <p className="empty">No invites yet. Create the first one above.</p>
      ) : (
        <div className="table-wrap" role="region" aria-label="Invites" tabIndex={0}>
          <table className="table">
            <caption className="sr-only">Invites, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Invited by</th>
                <th scope="col">Date</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <th scope="row">{inv.email}</th>
                  <td>
                    <span className={`pill status ${inv.status}`}>{STATUS_LABEL[inv.status]}</span>
                  </td>
                  <td>{inv.created_by_name}</td>
                  <td>{dateText(inv)}</td>
                  <td>
                    {inv.status !== 'used' && (
                      <button type="button" className="btn" onClick={() => revoke(inv)}>
                        {inv.status === 'pending' ? 'Revoke' : 'Remove'}
                        <span className="sr-only"> invite for {inv.email}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}