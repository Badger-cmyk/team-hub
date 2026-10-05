import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import authRoutes from './routes/auth.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

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

  return app;
}