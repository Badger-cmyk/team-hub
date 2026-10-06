import { useEffect, useRef, useState } from 'react';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function ResourceCard({ resource: r, user, onVote, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef(null);
  const cancelRef = useRef(null);

  const headingId = `res-${r.id}-title`;
  // The server enforces this too. Hiding the buttons is only for convenience.
  const canManage = String(user.id) === String(r.created_by) || user.role === 'admin';

  // When the confirmation appears, focus the safe choice (Cancel).
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  function cancelDelete() {
    setConfirming(false);
    // Put focus back on the Delete button once it has been drawn again.
    setTimeout(() => deleteRef.current?.focus(), 0);
  }

  async function confirmDelete() {
    setDeleting(true);
    const deleted = await onDelete(r);
    if (!deleted) {
      // On success this card is removed. On failure, let the person try again.
      setDeleting(false);
      setTimeout(() => cancelRef.current?.focus(), 0);
    }
  }

  return (
    <li className="card resource">
      <button
        type="button"
        className={`vote${r.voted ? ' on' : ''}`}
        aria-pressed={r.voted}
        aria-label={`Upvote ${r.title}. ${r.votes} ${r.votes === 1 ? 'vote' : 'votes'}`}
        onClick={() => onVote(r)}
      >
        <span aria-hidden="true">{r.voted ? '▲' : '△'}</span>
        <span aria-hidden="true">{r.votes}</span>
      </button>

      <article aria-labelledby={headingId} className="resource-body">
        <h2 id={headingId}>
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            {r.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h2>

        {r.description && <p className="desc">{r.description}</p>}

        <ul className="meta" aria-label="Details">
          <li className="pill">{r.category}</li>
          {r.is_onboarding && <li className="pill onboarding">Onboarding</li>}
          {r.tags.map((t) => (
            <li key={t} className="pill tag">
              {t}
            </li>
          ))}
        </ul>

        <p className="byline">
          Added by {r.contributor} on{' '}
          <time dateTime={r.created_at}>{dateFormat.format(new Date(r.created_at))}</time>
        </p>

        {canManage &&
          (confirming ? (
            <div className="confirm" role="group" aria-label={`Confirm deleting ${r.title}`}>
              <p>Delete “{r.title}”? This cannot be undone.</p>
              <div className="actions small">
                <button
                  type="button"
                  className="btn danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" className="btn" ref={cancelRef} onClick={cancelDelete}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="actions small">
              <button type="button" className="btn" onClick={(e) => onEdit(r, e.currentTarget)}>
                Edit<span className="sr-only"> {r.title}</span>
              </button>
              <button
                type="button"
                className="btn danger"
                ref={deleteRef}
                onClick={() => setConfirming(true)}
              >
                Delete<span className="sr-only"> {r.title}</span>
              </button>
            </div>
          ))}
      </article>
    </li>
  );
}