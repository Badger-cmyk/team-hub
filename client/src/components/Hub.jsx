import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import ResourceCard from './ResourceCard.jsx';

export default function Hub({ user, onSignOut }) {
  const [categories, setCategories] = useState([]);
  // The latest answer from the server, tagged with the request it belongs to.
  const [result, setResult] = useState({ key: null, resources: [], error: '' });
  // Bumping this re-runs the request ("Try again", and later after adding a resource).
  const [attempt, setAttempt] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onboardingOnly, setOnboardingOnly] = useState(false);
  const [sort, setSort] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    api
      .categories()
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  // Wait until the person pauses typing before searching.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo(
    () => ({ q: debouncedSearch, category, sort, onboarding: onboardingOnly ? 'true' : '' }),
    [debouncedSearch, category, sort, onboardingOnly]
  );
  const requestKey = JSON.stringify([params, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .list(params, controller.signal)
      .then((data) => setResult({ key: requestKey, resources: data.resources, error: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return; // a newer search replaced this one
        setResult({
          key: requestKey,
          resources: [],
          error: err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
        });
      });
    return () => controller.abort();
  }, [params, requestKey]);

  // Loading just means: the results we hold are not for the current filters.
  const loading = result.key !== requestKey;
  // Only replace the list with a loading message on the first load or after an error.
  const showLoadingText = loading && (result.key === null || result.error);
  const { resources, error: loadError } = result;
  const filtersActive = Boolean(debouncedSearch || category || onboardingOnly);

  const reload = () => setAttempt((n) => n + 1);

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setCategory('');
    setOnboardingOnly(false);
    // The button disappears when the list returns, so put focus somewhere sensible.
    searchRef.current?.focus();
  }

  // Read out by screen readers when results change, without moving focus.
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

        <section aria-label="Search and filters" className="filters">
          <div className="field">
            <label htmlFor="search">Search resources</label>
            <input
              id="search"
              ref={searchRef}
              type="search"
              value={search}
              placeholder="For example: git branching"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <fieldset className="chips">
            <legend>Category</legend>
            <button
              type="button"
              className="chip"
              aria-pressed={category === ''}
              onClick={() => setCategory('')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </fieldset>

          <div className="row">
            <div className="check">
              <input
                id="onb-only"
                type="checkbox"
                checked={onboardingOnly}
                onChange={(e) => setOnboardingOnly(e.target.checked)}
              />
              <label htmlFor="onb-only">Onboarding path only</label>
            </div>
            <div className="field inline">
              <label htmlFor="sort">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="">Best match, then most upvoted</option>
                <option value="recent">Newest</option>
              </select>
            </div>
          </div>
        </section>

        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {showLoadingText ? (
          <p className="center">Loading resources…</p>
        ) : loadError ? (
          <div className="error-summary" role="alert">
            {loadError}{' '}
            <button type="button" className="link" onClick={reload}>
              Try again
            </button>
          </div>
        ) : resources.length === 0 ? (
          <div className="empty">
            <h2>{filtersActive ? 'No resources match' : 'Start the library'}</h2>
            <p>
              {filtersActive
                ? 'Try different words or clear a filter. Search matches the beginning of words, so "dock" finds "docker".'
                : 'Nothing has been shared yet.'}
            </p>
            {filtersActive && (
              <button type="button" className="btn" onClick={clearFilters}>
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <ul className="list" aria-label="Resources" aria-busy={loading}>
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}