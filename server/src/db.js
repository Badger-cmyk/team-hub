import pg from 'pg';

// A pool keeps a few connections open and reuses them between requests.
// Opening a new connection for every request would be slow.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export const query = (text, params) => pool.query(text, params);