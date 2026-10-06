import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { signToken, requireAuth, hashToken } from '../auth.js';

const router = Router();

const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_INVITE =
  'This invite link is invalid, expired or already used. Ask an admin for a new one.';

// Used when an email has no account, so the check takes as long as a real one.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
};

// Tells the registration page which email an invite belongs to.
router.post('/invite-check', async (req, res) => {
  const invite = typeof req.body?.invite === 'string' ? req.body.invite.trim() : '';
  if (!invite) return res.status(403).json({ error: INVALID_INVITE });
  try {
    const { rows } = await query(
      `SELECT email FROM invites
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashToken(invite)]
    );
    if (rows.length === 0) return res.status(403).json({ error: INVALID_INVITE });
    res.json({ email: rows[0].email });
  } catch (err) {
    serverError(res, err);
  }
});

router.post('/register', async (req, res) => {
  const b = req.body || {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const invite = typeof b.invite === 'string' ? b.invite.trim() : '';

  const fields = {};
  if (!name) fields.name = 'Enter your name.';
  else if (name.length > 100) fields.name = 'Keep your name under 100 characters.';
  if (!email) fields.email = 'Enter your email address.';
  else if (email.length > 254 || !SHAPE.test(email)) fields.email = 'Enter a valid email address.';
  if (password.length < 8) fields.password = 'Use at least 8 characters.';
  else if (password.length > 72) fields.password = 'Use 72 characters or fewer.'; // bcrypt ignores the rest
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'Fix the highlighted fields.', fields });
  }

  // The admin's own address can register without an invite. That's how the first account exists.
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isFirstAdmin = adminEmail !== '' && email === adminEmail;

  if (!isFirstAdmin && !invite) {
    return res
      .status(403)
      .json({ error: 'Registration is by invitation. Ask an admin for an invite link.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inviteId = null;
    if (!isFirstAdmin) {
      // Claim the invite. This only succeeds if it exists, matches this email, is unused
      // and hasn't expired. Two people using it at once can't both succeed.
      const claimed = await client.query(
        `UPDATE invites SET used_at = now()
          WHERE token_hash = $1 AND email = $2 AND used_at IS NULL AND expires_at > now()
        RETURNING id`,
        [hashToken(invite), email]
      );
      if (claimed.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: INVALID_INVITE });
      }
      inviteId = claimed.rows[0].id;
    }

    const role = isFirstAdmin ? 'admin' : 'member';
    const created = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );
    const user = created.rows[0];

    if (inviteId) {
      await client.query('UPDATE invites SET used_by = $1 WHERE id = $2', [user.id, inviteId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // 23505 = unique violation: that email already has an account. The rollback frees the invite.
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Fix the highlighted fields.',
        fields: { email: 'An account with this email already exists.' },
      });
    }
    serverError(res, err);
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  try {
    const { rows } = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = $1',
      [email]
    );
    const row = rows[0];
    // Always run a comparison, so a missing account takes as long as a wrong password.
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    res.json({ token: signToken(user), user });
  } catch (err) {
    serverError(res, err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (rows.length === 0) return res.status(401).json({ error: 'Sign in to continue.' });
    res.json({ user: rows[0] });
  } catch (err) {
    serverError(res, err);
  }
});

export default router;