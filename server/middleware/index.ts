/**
 * middleware/index.ts
 * Central middleware — error handler + request logger + (legacy) API-key guard
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../config/logger';
import { HttpError } from '../types';

export const errorHandler: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  const status  = err.status || (err as { statusCode?: number }).statusCode || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    logger.error(`${req.method} ${req.path} → ${status}: ${message}`, { stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({
    error:   true,
    status,
    message,
    path:    req.path,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

// Legacy API-key guard — kept for back-compat. Real auth lives in requireAuth.ts.
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'development' && !process.env.INTERNAL_API_KEY) {
    return next();
  }
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ error: true, message: 'Unauthorized — missing or invalid API key.' });
    return;
  }
  next();
}

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  logger.debug(`→ ${req.method} ${req.path}`, {
    ip:     req.ip,
    client: req.headers['x-client-id'] || 'unknown',
  });
  next();
}
