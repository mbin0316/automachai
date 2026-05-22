/**
 * requireAuth.ts — JWT cookie middleware
 *
 * Reads the "fd_token" HttpOnly cookie, verifies the JWT, and attaches the
 * admin record to req.admin.
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as admins from '../config/admins';

export const COOKIE_NAME = 'fd_token';
const TOKEN_TTL = '12h';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s === 'change-me') {
    throw new Error('JWT_SECRET env var is not configured. Set it in server/.env');
  }
  return s;
}

interface AdminLike {
  id:    string;
  email: string;
  role?: string;
}

export function signToken(admin: AdminLike): string {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role || 'admin' },
    secret(),
    { expiresIn: TOKEN_TTL },
  );
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   12 * 60 * 60 * 1000,
    path:     '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) { res.status(401).json({ error: true, message: 'Not authenticated.' }); return; }
  try {
    const payload = jwt.verify(token, secret()) as JwtPayload;
    const adminRow = await admins.findById(String(payload.sub));
    if (!adminRow) { res.status(401).json({ error: true, message: 'Admin no longer exists.' }); return; }
    const pub = admins.publicView(adminRow);
    if (!pub) { res.status(401).json({ error: true, message: 'Admin no longer exists.' }); return; }
    req.admin = pub;
    next();
  } catch {
    res.status(401).json({ error: true, message: 'Invalid or expired session.' });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'owner') {
    res.status(403).json({ error: true, message: 'Owner role required.' });
    return;
  }
  next();
}
