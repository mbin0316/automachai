#!/usr/bin/env tsx
/**
 * One-shot migration: copy legacy ./data/*.json files into Postgres.
 * Run with: npm run db:migrate-json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { query, pool } from '../config/db';

const DATA_DIR   = path.resolve(__dirname, '..', 'data');
const CLIENTS_FP = path.join(DATA_DIR, 'clients.json');
const ADMINS_FP  = path.join(DATA_DIR, 'admins.json');
const TOKENS_DIR = path.join(DATA_DIR, 'tokens');

interface LegacyClient {
  id:     string;
  name:   string;
  city?:  string;
  status?: string;
  retell?: { agentId?: string; agentName?: string };
  n8n?:    { webhooks?: unknown[] };
  google?: { calendarId?: string };
}

interface LegacyAdmin {
  id:           string;
  email:        string;
  name?:        string;
  role?:        string;
  passwordHash: string;
  createdAt?:   string;
}

async function migrateClients(): Promise<void> {
  if (!fs.existsSync(CLIENTS_FP)) {
    console.log('• clients.json not found, skipping');
    return;
  }
  const rows: LegacyClient[] = JSON.parse(fs.readFileSync(CLIENTS_FP, 'utf8'));
  let inserted = 0;
  for (const c of rows) {
    const r = await query(
      `INSERT INTO clients (id, name, city, status, agent_id, agent_name, calendar_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        c.name,
        c.city || '',
        c.status || 'active',
        c.retell?.agentId || null,
        c.retell?.agentName || null,
        c.google?.calendarId || null,
      ],
    );
    inserted += r.rowCount ?? 0;
  }
  console.log(`• clients: inserted ${inserted}, skipped ${rows.length - inserted}`);
}

async function migrateAdmins(): Promise<void> {
  if (!fs.existsSync(ADMINS_FP)) {
    console.log('• admins.json not found, skipping');
    return;
  }
  const rows: LegacyAdmin[] = JSON.parse(fs.readFileSync(ADMINS_FP, 'utf8'));
  let inserted = 0;
  for (const a of rows) {
    const r = await query(
      `INSERT INTO admins (id, email, name, role, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.email, a.name || null, a.role || 'admin', a.passwordHash, a.createdAt || new Date().toISOString()],
    );
    inserted += r.rowCount ?? 0;
  }
  console.log(`• admins: inserted ${inserted}, skipped ${rows.length - inserted}`);
}

async function migrateTokens(): Promise<void> {
  if (!fs.existsSync(TOKENS_DIR)) {
    console.log('• tokens/ dir not found, skipping');
    return;
  }
  const files = fs.readdirSync(TOKENS_DIR).filter((f) => f.endsWith('.json'));
  let inserted = 0;
  for (const file of files) {
    const clientId = file.replace(/\.json$/, '');
    const tokens   = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, file), 'utf8'));
    const r = await query(
      `INSERT INTO google_tokens (client_id, tokens)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (client_id) DO NOTHING`,
      [clientId, JSON.stringify(tokens)],
    );
    inserted += r.rowCount ?? 0;
  }
  console.log(`• tokens: inserted ${inserted}, skipped ${files.length - inserted}`);
}

(async () => {
  try {
    console.log('FlowDesk JSON → Postgres migration\n');
    await migrateClients();
    await migrateAdmins();
    await migrateTokens();
    console.log('\nDone.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool().end();
  }
})();
