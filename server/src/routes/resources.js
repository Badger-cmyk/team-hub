import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const RESOURCE_SELECT = `
  SELECT r.id, r.title, r.url, r.description, r.is_onboarding,
         r.created_at, r.created_by,
         c.name AS category,
         u.name AS contributor,
         COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
  FROM resources r
  JOIN categories c ON c.id = r.category_id
  JOIN users u ON u.id = r.created_by
  LEFT JOIN resource_tags rt ON rt.resource_id = r.id
  LEFT JOIN tags t ON t.id = rt.tag_id
`;
const RESOURCE_GROUP = 'GROUP BY r.id, c.name, u.name';

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
};
const sendInvalid = (res, fields) =>
  res.status(400).json({ error: 'Fix the highlighted fields.', fields });

// Only http and https links, so "javascript:" links can't run code when clicked.
function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function cleanTags(input) {
  if (!Array.isArray(input)) return [];
  const names = input
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(names)];
}

// Cleans the request body and returns the values plus one message per bad field.
function parseResource(body) {
  const b = body || {};
  const values = {
    title: typeof b.title === 'string' ? b.title.trim() : '',
    url: typeof b.url === 'string' ? b.url.trim() : '',
    description: typeof b.description === 'string' ? b.description.trim() : '',
    category: typeof b.category === 'string' ? b.category : '',
    tags: cleanTags(b.tags),
  };

  const fields = {};
  if (!values.title) fields.title = 'Enter a title.';
  else if (values.title.length > 150) fields.title = 'Keep the title under 150 characters.';
  if (!values.url) fields.url = 'Enter a link.';
  else if (!isHttpUrl(values.url)) fields.url = 'Enter a full link starting with https://';
  if (values.description.length > 1000) fields.description = 'Keep the description under 1000 characters.';
  if (!values.category) fields.category = 'Choose a category.';
  if (values.tags.length > 5) fields.tags = 'Use at most 5 tags.';
  else if (values.tags.some((t) => t.length > 30)) fields.tags = 'Keep each tag under 30 characters.';

  return { values, fields };
}

async function saveTags(client, resourceId, tags) {
  for (const name of tags) {
    const tag = await client.query(
      `INSERT INTO tags (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name]
    );
    await client.query(
      'INSERT INTO resource_tags (resource_id, tag_id) VALUES ($1, $2)',
      [resourceId, tag.rows[0].id]
    );
  }
}

async function getResource(id) {
  const { rows } = await query(`${RESOURCE_SELECT} WHERE r.id = $1 ${RESOURCE_GROUP}`, [id]);
  return rows[0];
}

// Runs before edit and delete. Lets the request through only for the owner or an admin.
async function requireOwnerOrAdmin(req, res, next) {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Resource not found.' });
  }
  try {
    const { rows } = await query('SELECT created_by FROM resources WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }
    const isOwner = String(rows[0].created_by) === String(req.user.id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only change resources you added.' });
    }
    next();
  } catch (err) {
    serverError(res, err);
  }
}

router.get('/categories', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query('SELECT name FROM categories ORDER BY name');
    res.json({ categories: rows.map((r) => r.name) });
  } catch (err) {
    serverError(res, err);
  }
});

router.get('/resources', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(`${RESOURCE_SELECT} ${RESOURCE_GROUP} ORDER BY r.created_at DESC`);
    res.json({ resources: rows });
  } catch (err) {
    serverError(res, err);
  }
});

router.post('/resources', requireAuth, async (req, res) => {
  const body = req.body || {};
  const { values, fields } = parseResource(body);
  if (Object.keys(fields).length) return sendInvalid(res, fields);

  const isOnboarding = req.user.role === 'admin' && body.is_onboarding === true;

  const client = await pool.connect();
  try {
    const cat = await client.query('SELECT id FROM categories WHERE name = $1', [values.category]);
    if (cat.rowCount === 0) return sendInvalid(res, { category: 'Choose a category from the list.' });

    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO resources (title, url, description, category_id, created_by, is_onboarding)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [values.title, values.url, values.description, cat.rows[0].id, req.user.id, isOnboarding]
    );
    const resourceId = inserted.rows[0].id;
    await saveTags(client, resourceId, values.tags);
    await client.query('COMMIT');

    res.status(201).json({ resource: await getResource(resourceId) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    serverError(res, err);
  } finally {
    client.release();
  }
});

router.put('/resources/:id', requireAuth, requireOwnerOrAdmin, async (req, res) => {
  const body = req.body || {};
  const { values, fields } = parseResource(body);
  if (Object.keys(fields).length) return sendInvalid(res, fields);

  // Only an admin can change the onboarding flag. For everyone else it stays as it was.
  const onboarding =
    req.user.role === 'admin' && typeof body.is_onboarding === 'boolean' ? body.is_onboarding : null;

  const client = await pool.connect();
  try {
    const cat = await client.query('SELECT id FROM categories WHERE name = $1', [values.category]);
    if (cat.rowCount === 0) return sendInvalid(res, { category: 'Choose a category from the list.' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE resources
       SET title = $1, url = $2, description = $3, category_id = $4,
           is_onboarding = COALESCE($5, is_onboarding), updated_at = now()
       WHERE id = $6`,
      [values.title, values.url, values.description, cat.rows[0].id, onboarding, req.params.id]
    );
    // Replace the tag links with the new set.
    await client.query('DELETE FROM resource_tags WHERE resource_id = $1', [req.params.id]);
    await saveTags(client, req.params.id, values.tags);
    await client.query('COMMIT');

    res.json({ resource: await getResource(req.params.id) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    serverError(res, err);
  } finally {
    client.release();
  }
});

router.delete('/resources/:id', requireAuth, requireOwnerOrAdmin, async (req, res) => {
  try {
    await query('DELETE FROM resources WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    serverError(res, err);
  }
});

export default router;