/**
 * routes/auth.ts — sign-in / sign-out / account bootstrap
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import * as admins from '../config/admins';
import {
  requireAuth, signToken, setAuthCookie, clearAuthCookie,
} from '../middleware/requireAuth';

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'email and password are required.' });
    }
    const admin = await admins.verifyPassword(email, password);
    if (!admin) {
      logger.warn(`Login failed for ${email}`);
      return res.status(401).json({ error: true, message: 'Invalid email or password.' });
    }
    setAuthCookie(res, signToken(admin));
    logger.info(`Login: ${admin.email}`);
    res.json({ admin: admins.publicView(admin) });
  } catch (err) { next(err); }
});

router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Bootstrap — only works while the admin table is empty.
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if ((await admins.count()) > 0) {
      return res.status(403).json({ error: true, message: 'Signup is disabled — an admin already exists. Ask an existing admin to invite you.' });
    }
    const { email, password, name } = req.body || {};
    const created = await admins.create({ email, password, name });
    const row = await admins.findById(created.id);
    if (row) setAuthCookie(res, signToken(row));
    logger.info(`Bootstrap admin created: ${created.email}`);
    res.status(201).json({ admin: created });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ admin: req.admin, bootstrap: false });
});

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const n = await admins.count();
    res.json({ adminCount: n, bootstrap: n === 0 });
  } catch (err) { next(err); }
});

router.post('/change-password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const updated = await admins.changePassword(req.admin!.id, currentPassword, newPassword);
    logger.info(`Password changed: ${updated.email}`);
    res.json({ admin: updated });
  } catch (err) { next(err); }
});

export default router;
