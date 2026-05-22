/**
 * routes/clients.ts — Multi-tenant client management
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import * as clients from '../config/clients';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ clients: await clients.list() }); }
  catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await clients.get(String(req.params.id));
    res.json(clients.safeView(c));
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await clients.create(req.body || {});
    logger.info(`Client created: ${created.id} (${created.name})`);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.put('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['active', 'warning', 'inactive'].includes(status)) {
      return res.status(400).json({ error: true, message: 'status must be: active | warning | inactive' });
    }
    res.json(await clients.updateStatus(String(req.params.id), status));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await clients.remove(String(req.params.id));
    logger.info(`Client deleted: ${String(req.params.id)}`);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
