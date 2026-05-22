/**
 * admins.ts — admin user store backed by Postgres.
 * Passwords are bcrypt-hashed; the DB never sees plaintext.
 */

import bcrypt from 'bcryptjs';
import { query } from './db';
import { AdminPublic, AdminRow, HttpError } from '../types';

const BCRYPT_ROUNDS = 10;

function rowToPublic(r: AdminRow | undefined | null): AdminPublic | null {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    createdAt: r.created_at,
  };
}

export function publicView(r: AdminRow | undefined | null): AdminPublic | null {
  return rowToPublic(r);
}

export async function list(): Promise<AdminPublic[]> {
  const { rows } = await query<AdminRow>(
    `SELECT id, email, name, role, password_hash, created_at FROM admins ORDER BY created_at ASC`,
  );
  return rows.map((r) => rowToPublic(r)!);
}

export async function count(): Promise<number> {
  const { rows } = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM admins`);
  return rows[0]!.c;
}

export async function findByEmail(email: string | undefined | null): Promise<AdminRow | null> {
  if (!email) return null;
  const { rows } = await query<AdminRow>(
    `SELECT * FROM admins WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

export async function findById(id: string): Promise<AdminRow | null> {
  const { rows } = await query<AdminRow>(`SELECT * FROM admins WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

interface CreateInput {
  email?:    string;
  password?: string;
  name?:     string;
}

function httpErr(message: string, status: number): HttpError {
  const e: HttpError = new Error(message);
  e.status = status;
  return e;
}

export async function create({ email, password, name }: CreateInput): Promise<AdminPublic> {
  if (!email || !password) throw httpErr('email and password are required', 400);
  if (password.length < 8) throw httpErr('password must be at least 8 characters', 400);
  if (await findByEmail(email)) throw httpErr('An admin with that email already exists', 409);

  const id = `adm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const role = (await count()) === 0 ? 'owner' : 'admin';

  const { rows } = await query<AdminRow>(
    `INSERT INTO admins (id, email, name, role, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, password_hash, created_at`,
    [id, email.trim(), name?.trim() || null, role, hash],
  );
  return rowToPublic(rows[0])!;
}

export async function verifyPassword(email: string, password: string): Promise<AdminRow | null> {
  const row = await findByEmail(email);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  return ok ? row : null;
}

export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<AdminPublic> {
  if (!newPassword || newPassword.length < 8) {
    throw httpErr('new password must be at least 8 characters', 400);
  }
  const row = await findById(id);
  if (!row) throw httpErr('Admin not found', 404);

  const ok = await bcrypt.compare(currentPassword || '', row.password_hash);
  if (!ok) throw httpErr('Current password is incorrect', 401);

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { rows } = await query<AdminRow>(
    `UPDATE admins SET password_hash = $1 WHERE id = $2
     RETURNING id, email, name, role, password_hash, created_at`,
    [hash, id],
  );
  return rowToPublic(rows[0])!;
}

export async function remove(
  id: string,
  actingAdmin?: AdminPublic | null,
): Promise<{ id: string; deleted: boolean }> {
  const target = await findById(id);
  if (!target) throw httpErr('Admin not found', 404);
  if ((await count()) <= 1) throw httpErr('Cannot remove the last admin', 400);
  if (target.role === 'owner' && actingAdmin?.role !== 'owner') {
    throw httpErr('Only an owner can remove an owner', 403);
  }

  await query(`DELETE FROM admins WHERE id = $1`, [id]);
  return { id, deleted: true };
}
