import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import ResourceCard from './ResourceCard.jsx';
import ResourceForm from './ResourceForm.jsx';

export default function Hub({ user }) {
  const [categories, setCategories] = useState([]);
  // The latest answer from the server, tagged with the request it belongs to.
  const [result, setResult] = useState({ key: null, resources: [], error: '' });
  // Bumping this re-runs the request ("Try again", and after adding or editing).
  const [attempt, setAttempt] = useState(0);
  // A message about the last action, tied to the search it happened under.
  // kind: 'vote' (read out quietly), 'info' (shown on screen), 'error' (shown and announced).
  const [notice, setNotice] = useState(null);
  const voting = useRef(new Set());

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onboardingOnly, setOnboardingOnly] = useState(false);
  const [sort, setSort] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const searchRef = useRef(null);
  const headingRef = useRef(null);
  const addButtonRef = useRef(null);
  const openerRef = useRef(null); // the button that opened the form, so focus can go back to it

  useEffect(() => {
    document.title = 'Resources – Team hub';
  }, []);

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
  const paramsKey = JSON.stringify(params);
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

  function openForm(resource, openerElement) {
    openerRef.current = openerElement;
    setEditing(resource);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    // Return focus to whatever opened the form, or the Add button if that is gone.
    setTimeout(() => {
      const el = openerRef.current;
      (el && document.contains(el) ? el : addButtonRef.current)?.focus();
    }, 0);
  }

  function handleSaved(resource, wasEditing) {
    closeForm();
    const hint = !wasEditing && filtersActive ? ' Clear the search and filters if you cannot see it.' : '';
    setNotice({
      key: paramsKey,
      kind: 'info',
      text: wasEditing ? `Saved changes to ${resource.title}.` : `Added ${resource.title}.${hint}`,
    });
    reload();
  }

  async function handleDelete(r) {
    try {
      await api.remove(r.id);
      setResult((cur) => ({ ...cur, resources: cur.resources.filter((x) => x.id !== r.id) }));
      setNotice({ key: paramsKey, kind: 'info', text: `Deleted ${r.title}.` });
      // The card the person was on is gone, so move focus to the page heading.
      headingRef.current?.focus();
      return true;
    } catch (err) {
      setNotice({
        key: paramsKey,
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Could not delete. Try again.',
      });
      return false;
    }
  }

  async function handleVote(r) {
    if (voting.current.has(r.id)) return; // ignore a second click while one is in flight
    voting.current.add(r.id);
    try {
      const { voted, votes } = await api.vote(r.id);
      // Update this one card in place. The list is not re-sorted, so nothing jumps under the cursor.
      setResult((cur) => ({
        ...cur,
        resources: cur.resources.map((x) => (x.id === r.id ? { ...x, voted, votes } : x)),
      }));
      const count = `${votes} ${votes === 1 ? 'vote' : 'votes'}`;
      setNotice({
        key: paramsKey,
        kind: 'vote',
        text: voted ? `Upvoted ${r.title}. ${count}.` : `Removed your upvote from ${r.title}. ${count}.`,
      });
    } catch (err) {
      setNotice({
        key: paramsKey,
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Could not save your vote. Try again.',
      });
    } finally {
      voting.current.delete(r.id);
    }
  }

  // A notice only applies while the same search is on screen.
  const activeNotice = notice && notice.key === paramsKey ? notice : null;

  // Read out quietly when results change or a vote is cast, without moving focus.
  const countText =
    loading || loadError
      ? ''
      : `${resources.length} ${resources.length === 1 ? 'resource' : 'resources'} found`;
  const liveText = activeNotice?.kind === 'vote' ? activeNotice.text : countText;

  return (
    <>
      <div className="titlebar">
        <h1 tabIndex={-1} ref={headingRef}>
          Resources
        </h1>
        <button
          type="button"
          className="btn primary"
          ref={addButtonRef}
          onClick={(e) => openForm(null, e.currentTarget)}
        >
          Add resource
        </button>
      </div>

      {formOpen && (
        <ResourceForm
          key={editing ? editing.id : 'new'}
          categories={categories}
          initial={editing}
          isAdmin={user.role === 'admin'}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      )}

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
        {liveText}
      </div>

      {/* Visible confirmation for saved and deleted. The container stays in the page so changes are announced. */}
      <div role="status">
        {activeNotice?.kind === 'info' && <p className="notice">{activeNotice.text}</p>}
      </div>

      {activeNotice?.kind === 'error' && (
        <div className="error-summary" role="alert">
          {activeNotice.text}
        </div>
      )}

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
              ? 'Try different words or clear a filter. Search matches the beginning of words, so "dock" finds "docker" but "ker" does not.'
              : 'Nothing has been shared yet. Add the first useful link.'}
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
            <ResourceCard
              key={r.id}
              resource={r}
              user={user}
              onVote={handleVote}
              onEdit={openForm}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </>
  );
}