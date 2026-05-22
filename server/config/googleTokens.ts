/**
 * googleTokens.ts — Per-client Google OAuth token storage in Postgres.
 */

import { query } from './db';
import { GoogleTokens } from '../types';

export async function load(clientId: string): Promise<GoogleTokens | null> {
  const { rows } = await query<{ tokens: GoogleTokens }>(
    `SELECT tokens FROM google_tokens WHERE client_id = $1 LIMIT 1`,
    [clientId],
  );
  return rows[0]?.tokens ?? null;
}

export async function save(clientId: string, tokens: GoogleTokens): Promise<void> {
  await query(
    `INSERT INTO google_tokens (client_id, tokens, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (client_id) DO UPDATE
       SET tokens = EXCLUDED.tokens,
           updated_at = NOW()`,
    [clientId, JSON.stringify(tokens)],
  );
}

export async function remove(clientId: string): Promise<void> {
  await query(`DELETE FROM google_tokens WHERE client_id = $1`, [clientId]);
}
