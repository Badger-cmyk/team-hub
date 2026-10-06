import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import Field from './Field.jsx';

export default function ResourceForm({ categories, initial, isAdmin, onSaved, onCancel }) {
  const editing = Boolean(initial);
  const [values, setValues] = useState({
    title: initial?.title || '',
    url: initial?.url || '',
    description: initial?.description || '',
    category: initial?.category || '',
    tags: initial?.tags?.join(', ') || '',
    is_onboarding: initial?.is_onboarding || false,
  });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const headingRef = useRef(null);
  const errorRef = useRef(null);

  // When the form opens, move focus to its heading so keyboard and screen reader users land in it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // When an error appears, move focus to it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setFields({});
    setBusy(true);
    const body = {
      ...values,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      const data = editing ? await api.update(initial.id, body) : await api.create(body);
      onSaved(data.resource, editing);
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
    <section className="card form-card" aria-labelledby="form-title">
      <h2 id="form-title" tabIndex={-1} ref={headingRef}>
        {editing ? 'Edit resource' : 'Add a resource'}
      </h2>
      <p className="hint">Title, link and category are required.</p>

      <form onSubmit={submit} noValidate>
        {error && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}

        <Field id="r-title" label="Title" error={fields.title}>
          {(p) => <input {...p} type="text" value={values.title} onChange={set('title')} />}
        </Field>

        <Field
          id="r-url"
          label="Link"
          hint="The full address, starting with https://"
          error={fields.url}
        >
          {(p) => (
            <input {...p} type="url" inputMode="url" value={values.url} onChange={set('url')} />
          )}
        </Field>

        <Field
          id="r-desc"
          label="Description"
          hint="Optional. Say what it covers and who it helps."
          error={fields.description}
        >
          {(p) => (
            <textarea {...p} rows={3} value={values.description} onChange={set('description')} />
          )}
        </Field>

        <Field id="r-cat" label="Category" error={fields.category}>
          {(p) => (
            <select {...p} value={values.category} onChange={set('category')}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          id="r-tags"
          label="Tags"
          hint="Optional. Separate with commas, up to 5. For example: git, onboarding"
          error={fields.tags}
        >
          {(p) => <input {...p} type="text" value={values.tags} onChange={set('tags')} />}
        </Field>

        {isAdmin && (
          <div className="check">
            <input
              id="r-onb"
              type="checkbox"
              checked={values.is_onboarding}
              onChange={(e) => setValues((v) => ({ ...v, is_onboarding: e.target.checked }))}
            />
            <label htmlFor="r-onb">Part of the onboarding path for new staff and interns</label>
          </div>
        )}

        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add resource'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}