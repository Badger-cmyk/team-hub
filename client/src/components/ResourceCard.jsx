const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function ResourceCard({ resource: r }) {
  const headingId = `res-${r.id}-title`;

  return (
    <li className="card">
      <article aria-labelledby={headingId}>
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
          <li className="pill">
            {r.votes} {r.votes === 1 ? 'upvote' : 'upvotes'}
          </li>
        </ul>

        <p className="byline">
          Added by {r.contributor} on{' '}
          <time dateTime={r.created_at}>{dateFormat.format(new Date(r.created_at))}</time>
        </p>
      </article>
    </li>
  );
}