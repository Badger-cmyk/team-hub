import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { query } from './db.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
}

// Use after requireAuth for powerful actions. It checks the role in the database,
// not the one inside the token, so a demoted admin loses access straight away.
export async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can do this.' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}

// Invite tokens are stored as a hash, so a leaked database contains no working links.
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}