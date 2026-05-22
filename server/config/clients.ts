/**
 * clients.ts — Multi-tenant client configuration store, backed by Postgres.
 */

import { query } from './db';
import { ClientInternal, ClientRow, ClientSafeView, HttpError } from '../types';

function rowToInternal(r: ClientRow | undefined | null): ClientInternal | null {
  if (!r) return null;
  return {
    id:     r.id,
    name:   r.name,
    city:   r.city || '',
    status: r.status,
    retell: { agentId: r.agent_id, agentName: r.agent_name },
    google: { calendarId: r.calendar_id || null },
    createdAt: r.created_at,
  };
}

export function safeView(c: ClientInternal | null): ClientSafeView | null {
  if (!c) return null;
  return {
    id:        c.id,
    name:      c.name,
    city:      c.city,
    status:    c.status,
    agentId:   c.retell?.agentId ?? null,
    agentName: c.retell?.agentName ?? null,
  };
}

function slugify(s: string | undefined): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function httpErr(message: string, status: number): HttpError {
  const e: HttpError = new Error(message);
  e.status = status;
  return e;
}

export async function list(): Promise<ClientSafeView[]> {
  const { rows } = await query<ClientRow>(`SELECT * FROM clients ORDER BY created_at ASC`);
  return rows.map((r) => safeView(rowToInternal(r))!);
}

export async function get(clientId: string): Promise<ClientInternal> {
  const { rows } = await query<ClientRow>(`SELECT * FROM clients WHERE id = $1 LIMIT 1`, [clientId]);
  const internal = rowToInternal(rows[0]);
  if (!internal) throw httpErr(`Client not found: ${clientId}`, 404);
  return internal;
}

export interface CreateClientInput {
  id?:         string;
  name:        string;
  city?:       string;
  status?:     string;
  agentId?:    string;
  agentName?:  string;
  calendarId?: string;
}

export async function create(input: CreateClientInput): Promise<ClientSafeView> {
  if (!input || !input.name || !input.name.trim()) throw httpErr('name is required', 400);

  const id = input.id?.trim() || slugify(input.name);
  if (!id) throw httpErr('Could not derive a valid id from name', 400);

  const existing = await query(`SELECT 1 FROM clients WHERE id = $1`, [id]);
  if ((existing.rowCount ?? 0) > 0) throw httpErr(`Client id already exists: ${id}`, 409);

  const agentId    = (input.agentId   || `agent_REPLACE_${id.toUpperCase()}`).trim();
  const agentName  = (input.agentName || `${input.name.trim()} Agent`).trim();
  const calendarId = (input.calendarId || '').trim() || null;

  const { rows } = await query<ClientRow>(
    `INSERT INTO clients (id, name, city, status, agent_id, agent_name, calendar_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.name.trim(),
      (input.city || '').trim(),
      input.status || 'active',
      agentId,
      agentName,
      calendarId,
    ],
  );
  return safeView(rowToInternal(rows[0]))!;
}

export async function updateStatus(clientId: string, status: string): Promise<ClientSafeView> {
  const { rows } = await query<ClientRow>(
    `UPDATE clients SET status = $1 WHERE id = $2 RETURNING *`,
    [status, clientId],
  );
  if (rows.length === 0) throw httpErr(`Client not found: ${clientId}`, 404);
  return safeView(rowToInternal(rows[0]))!;
}

export async function remove(clientId: string): Promise<{ id: string; deleted: boolean }> {
  const { rowCount } = await query(`DELETE FROM clients WHERE id = $1`, [clientId]);
  if ((rowCount ?? 0) === 0) throw httpErr(`Client not found: ${clientId}`, 404);
  return { id: clientId, deleted: true };
}
