import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { query } from './db.js';
import authRoutes from './routes/auth.js';
import resourceRoutes from './routes/resources.js';
import onboardingRoutes from './routes/onboarding.js';
import inviteRoutes from './routes/invites.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1)

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  // Slow down password guessing and invite-token guessing.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' }),
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/invite-check', authLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/health/db', async (_req, res) => {
  try {
    await query('SELECT now() AS time');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);

app.use('/api', resourceRoutes);

app.use('/api/onboarding', onboardingRoutes);

app.use('/api/invites', inviteRoutes);

  return app;
}