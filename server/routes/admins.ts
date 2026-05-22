/**
 * routes/admins.ts — account management for the admin user table.
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import * as admins from '../config/admins';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ admins: await admins.list() }); }
  catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await admins.create(req.body || {});
    logger.info(`Admin invited by ${req.admin!.email}: ${created.email}`);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (String(req.params.id) === req.admin!.id) {
      return res.status(400).json({ error: true, message: 'You cannot remove your own account.' });
    }
    const result = await admins.remove(String(req.params.id), req.admin);
    logger.info(`Admin ${String(req.params.id)} removed by ${req.admin!.email}`);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
