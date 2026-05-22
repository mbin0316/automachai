/**
 * db.ts — Postgres connection pool.
 *
 * Set DATABASE_URL in .env to a Neon connection string (use the "pooler"
 * variant — ends in -pooler.<region>.aws.neon.tech). For local development
 * with a local Postgres, e.g.:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/flowdesk
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

let _pool: Pool | null = null;

export function pool(): Pool {
  if (_pool) return _pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL env var is not configured. Set it in server/.env');
  }

  _pool = new Pool({
    connectionString: url,
    ssl: (process.env.DATABASE_SSL || 'true').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  _pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Postgres pool error', err);
  });

  return _pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool().query<T>(text, params as never);
}
