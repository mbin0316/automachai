/**
 * index.ts — FlowDesk Express Server
 *
 * Dev:    npm run dev      (tsx watch)
 * Prod:   npm run build && npm start
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import logger from './config/logger';
import { errorHandler, requestLogger } from './middleware';
import { requireAuth } from './middleware/requireAuth';

// Route modules
import authRouter     from './routes/auth';
import adminsRouter   from './routes/admins';
import clientsRouter  from './routes/clients';
import retellRouter   from './routes/retell';
import calendarRouter from './routes/calendar';
import patientsRouter from './routes/patients';

// Pull shared types in so the Express.Request augmentation is loaded
import './types';

const app  = express();
const PORT = Number(process.env.PORT || 4000);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" is not allowed`));
  },
  credentials: true,
}));

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
  skip:   (req) => req.path === '/health',
}));
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max:      120,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: true, message: 'Too many requests. Please try again in a minute.' },
}));

// ── Public auth routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Protected routes ──────────────────────────────────────────────────────────
app.use('/api/admins',   requireAuth, adminsRouter);
app.use('/api/clients',  requireAuth, clientsRouter);
app.use('/api/retell',   requireAuth, retellRouter);
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/patients', requireAuth, patientsRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'flowdesk-server',
    env:       process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    integrations: {
      retell:   !!process.env.RETELL_API_KEY,
      google:   !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: true, message: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`FlowDesk server running on http://localhost:${PORT}`);
  logger.info(`Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS origins: ${allowedOrigins.join(', ')}`);

  if (!process.env.RETELL_API_KEY) logger.warn('⚠  RETELL_API_KEY not set — mock data will be used');
  if (!process.env.GOOGLE_CLIENT_ID) logger.warn('⚠  Google OAuth not configured — run /api/calendar/oauth/connect to authorise');
});

export default app;
