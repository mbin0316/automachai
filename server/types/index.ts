/**
 * Shared type definitions for the FlowDesk server.
 */

// ── Express augmentation: attach req.admin via requireAuth middleware ─────────
declare global {
  namespace Express {
    interface Request {
      admin?: AdminPublic;
    }
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface AdminPublic {
  id:        string;
  email:     string;
  name:      string | null;
  role:      string;
  createdAt: string | Date;
}

export interface AdminRow {
  id:             string;
  email:          string;
  name:           string | null;
  role:           string;
  password_hash:  string;
  created_at:     Date;
}

// ── Client ────────────────────────────────────────────────────────────────────
export interface ClientInternal {
  id:        string;
  name:      string;
  city:      string;
  status:    string;
  retell:    { agentId: string | null; agentName: string | null };
  google:    { calendarId: string | null };
  createdAt: Date | string;
}

export interface ClientSafeView {
  id:        string;
  name:      string;
  city:      string;
  status:    string;
  agentId:   string | null;
  agentName: string | null;
}

export interface ClientRow {
  id:          string;
  name:        string;
  city:        string | null;
  status:      string;
  agent_id:    string | null;
  agent_name:  string | null;
  calendar_id: string | null;
  created_at:  Date;
}

// ── Google OAuth tokens ───────────────────────────────────────────────────────
export interface GoogleTokens {
  access_token?:  string;
  refresh_token?: string;
  scope?:         string;
  token_type?:    string;
  expiry_date?:   number;
  [k: string]:    unknown;
}

// ── Errors with HTTP status ───────────────────────────────────────────────────
export interface HttpError extends Error {
  status?: number;
}

export {};
