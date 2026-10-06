import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
};

// How many onboarding items exist, and how many this person has completed.
// Only items still flagged as onboarding are counted.
async function getSummary(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM resources WHERE is_onboarding = true) AS total,
       (SELECT COUNT(*)::int
          FROM onboarding_progress op
          JOIN resources r ON r.id = op.resource_id
         WHERE op.user_id = $1 AND r.is_onboarding = true) AS completed`,
    [userId]
  );
  return rows[0];
}

// The checklist, with this person's progress on each item.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.title, r.url, r.description,
              c.name AS category,
              (op.user_id IS NOT NULL) AS done,
              op.completed_at
         FROM resources r
         JOIN categories c ON c.id = r.category_id
         LEFT JOIN onboarding_progress op
                ON op.resource_id = r.id AND op.user_id = $1
        WHERE r.is_onboarding = true
        ORDER BY r.created_at ASC, r.id ASC`,
      [req.user.id]
    );
    const summary = await getSummary(req.user.id);
    res.json({ items: rows, ...summary });
  } catch (err) {
    serverError(res, err);
  }
});

// Set one item to done or not done. Sending the same request twice gives the same result.
router.put('/:id', requireAuth, async (req, res) => {
  const resourceId = req.params.id;
  if (!/^\d+$/.test(resourceId)) {
    return res.status(404).json({ error: 'Onboarding item not found.' });
  }
  const done = req.body?.done;
  if (typeof done !== 'boolean') {
    return res.status(400).json({ error: 'Send "done" as true or false.' });
  }

  try {
    const exists = await query(
      'SELECT 1 FROM resources WHERE id = $1 AND is_onboarding = true',
      [resourceId]
    );
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: 'Onboarding item not found.' });
    }

    if (done) {
      await query(
        `INSERT INTO onboarding_progress (user_id, resource_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.user.id, resourceId]
      );
    } else {
      await query(
        'DELETE FROM onboarding_progress WHERE user_id = $1 AND resource_id = $2',
        [req.user.id, resourceId]
      );
    }

    const summary = await getSummary(req.user.id);
    res.json({ done, ...summary });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;