-- FlowDesk schema for Neon Postgres
-- Run once on a fresh DB:  psql "$DATABASE_URL" -f server/db/schema.sql

CREATE TABLE IF NOT EXISTS admins (
  id             TEXT        PRIMARY KEY,
  email          TEXT        NOT NULL UNIQUE,
  name           TEXT,
  role           TEXT        NOT NULL DEFAULT 'admin',
  password_hash  TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email_lower ON admins (LOWER(email));

CREATE TABLE IF NOT EXISTS clients (
  id            TEXT        PRIMARY KEY,
  name          TEXT        NOT NULL,
  city          TEXT,
  status        TEXT        NOT NULL DEFAULT 'active',
  agent_id      TEXT,
  agent_name    TEXT,
  calendar_id   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If you previously ran an older schema with a `webhooks` JSONB column, drop it:
ALTER TABLE clients DROP COLUMN IF EXISTS webhooks;

-- Per-client Google OAuth token blobs (one row per client).
-- Stored encrypted-at-rest by Neon. If you need column-level encryption later,
-- wrap `tokens` writes with pgcrypto.
CREATE TABLE IF NOT EXISTS google_tokens (
  client_id   TEXT        PRIMARY KEY
              REFERENCES clients (id) ON DELETE CASCADE,
  tokens      JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
