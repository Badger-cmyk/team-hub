import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// One SELECT shared by "list all" and "get one", so the response shape never drifts.
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

// Only http and https links. Blocks "javascript:" links, which could run code
// when someone clicks the resource later.
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

router.get('/categories', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query('SELECT name FROM categories ORDER BY name');
    res.json({ categories: rows.map((r) => r.name) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

router.get('/resources', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      `${RESOURCE_SELECT} ${RESOURCE_GROUP} ORDER BY r.created_at DESC`
    );
    res.json({ resources: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

router.post('/resources', requireAuth, async (req, res) => {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const tags = cleanTags(body.tags);

  // One message per field. The form will attach each message to its own input.
  const fields = {};
  if (!title) fields.title = 'Enter a title.';
  else if (title.length > 150) fields.title = 'Keep the title under 150 characters.';
  if (!url) fields.url = 'Enter a link.';
  else if (!isHttpUrl(url)) fields.url = 'Enter a full link starting with https://';
  if (description.length > 1000) fields.description = 'Keep the description under 1000 characters.';
  if (!category) fields.category = 'Choose a category.';
  if (tags.length > 5) fields.tags = 'Use at most 5 tags.';
  else if (tags.some((t) => t.length > 30)) fields.tags = 'Keep each tag under 30 characters.';

  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'Fix the highlighted fields.', fields });
  }

  // Only admins can mark something as part of the onboarding path.
  const isOnboarding = req.user.role === 'admin' && body.is_onboarding === true;

  const client = await pool.connect();
  try {
    const cat = await client.query('SELECT id FROM categories WHERE name = $1', [category]);
    if (cat.rowCount === 0) {
      return res.status(400).json({ error: 'Fix the highlighted fields.', fields: { category: 'Choose a category from the list.' } });
    }

    // A transaction: the resource and its tags are saved together or not at all.
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO resources (title, url, description, category_id, created_by, is_onboarding)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, url, description, cat.rows[0].id, req.user.id, isOnboarding]
    );
    const resourceId = inserted.rows[0].id;

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
    await client.query('COMMIT');

    const { rows } = await query(`${RESOURCE_SELECT} WHERE r.id = $1 ${RESOURCE_GROUP}`, [resourceId]);
    res.status(201).json({ resource: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  } finally {
    client.release();
  }
});

export default router;