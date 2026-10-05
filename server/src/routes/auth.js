import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const fields = {};
    if (name.length < 2) fields.name = 'Enter your name.';
    if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
    if (password.length < 8) fields.password = 'Use at least 8 characters.';
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: 'Check the highlighted fields.', fields });
    }

    const hash = await bcrypt.hash(password, 10);

    // Whoever registers with the ADMIN_EMAIL address becomes the admin.
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const role = adminEmail && email === adminEmail ? 'admin' : 'member';

    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [name, email, hash, role]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Check the highlighted fields.',
        fields: { email: 'That email is already registered. Sign in instead.' },
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
  }
});

export default router;