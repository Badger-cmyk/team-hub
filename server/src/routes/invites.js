import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { query } from '../db.js';
import { requireAuth, requireAdmin, hashToken } from '../auth.js';

const router = Router();
// Every route in this file is for admins only.
router.use(requireAuth, requireAdmin);

const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
};

// Create an invite. The link is returned once and can't be recovered later.
router.post('/', async (req, res) => {
  const raw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!raw || raw.length > 254 || !SHAPE.test(raw)) {
    return res.status(400).json({
      error: 'Fix the highlighted fields.',
      fields: { email: 'Enter a valid email address.' },
    });
  }

  try {
    const existingUser = await query('SELECT 1 FROM users WHERE lower(email) = $1', [raw]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        error: 'Fix the highlighted fields.',
        fields: { email: 'That person already has an account.' },
      });
    }

    const pending = await query(
      'SELECT 1 FROM invites WHERE email = $1 AND used_at IS NULL AND expires_at > now()',
      [raw]
    );
    if (pending.rowCount > 0) {
      return res.status(409).json({
        error: 'Fix the highlighted fields.',
        fields: { email: 'That email already has a pending invite. Revoke it first to make a new one.' },
      });
    }

    // 32 random bytes: far too many possibilities to guess.
    const token = randomBytes(32).toString('base64url');
    const { rows } = await query(
      `INSERT INTO invites (email, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, now() + interval '7 days')
       RETURNING id, email, created_at, expires_at`,
      [raw, hashToken(token), req.user.id]
    );

    const origin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    res.status(201).json({
      invite: { ...rows[0], status: 'pending' },
      link: `${origin}/register?invite=${token}`,
    });
  } catch (err) {
    serverError(res, err);
  }
});

// List all invites with a status: pending, used or expired.
router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.email, i.created_at, i.expires_at, i.used_at,
              u.name AS created_by_name,
              CASE WHEN i.used_at IS NOT NULL THEN 'used'
                   WHEN i.expires_at < now() THEN 'expired'
                   ELSE 'pending' END AS status
         FROM invites i
         JOIN users u ON u.id = i.created_by
        ORDER BY i.created_at DESC`
    );
    res.json({ invites: rows });
  } catch (err) {
    serverError(res, err);
  }
});

// Revoke an invite that hasn't been used yet. Used invites stay as a record.
router.delete('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Invite not found.' });
  }
  try {
    const { rowCount } = await query(
      'DELETE FROM invites WHERE id = $1 AND used_at IS NULL',
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Invite not found.' });
    res.status(204).end();
  } catch (err) {
    serverError(res, err);
  }
});

export default router;