/**
 * routes/calendar.ts — Google Calendar integration.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { google, calendar_v3 } from 'googleapis';
import logger from '../config/logger';
import * as clients from '../config/clients';
import * as tokenStore from '../config/googleTokens';
import { GoogleTokens, HttpError } from '../types';

const router = Router();

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

async function saveTokens(clientId: string, tokens: GoogleTokens): Promise<void> {
  await tokenStore.save(clientId, tokens);
  logger.info(`Saved Google tokens for client: ${clientId}`);
}

async function getCalendarClient(clientId: string): Promise<calendar_v3.Calendar> {
  const auth   = makeOAuth2Client();
  const tokens = await tokenStore.load(clientId);
  if (!tokens) {
    const err: HttpError = new Error(`Google Calendar not authorised for client "${clientId}". Visit /api/calendar/oauth/connect?clientId=${clientId}`);
    err.status = 401;
    throw err;
  }
  auth.setCredentials(tokens);
  auth.on('tokens', (fresh) => {
    if (fresh.refresh_token) tokens.refresh_token = fresh.refresh_token;
    if (fresh.access_token)  tokens.access_token  = fresh.access_token;
    if (fresh.expiry_date)   tokens.expiry_date   = fresh.expiry_date;
    saveTokens(clientId, tokens).catch((err) => logger.error(`Token refresh save failed: ${err.message}`));
  });
  return google.calendar({ version: 'v3', auth });
}

function normaliseEvent(ev: calendar_v3.Schema$Event) {
  const desc  = ev.description || '';
  const props = (ev.extendedProperties?.private || {}) as Record<string, string | undefined>;

  const doctorMatch = desc.match(/Doctor:\s*(.+)/i);
  const doctor      = props.doctor || (doctorMatch ? doctorMatch[1]!.trim() : 'TBC');
  const phoneMatch  = desc.match(/Phone:\s*(.+)/i);
  const phone       = props.patientPhone || (phoneMatch ? phoneMatch[1]!.trim() : null);
  const reasonMatch = desc.match(/Reason:\s*(.+)/i);
  const reason      = reasonMatch ? reasonMatch[1]!.trim() : ev.summary || '';
  const patient     = ev.summary?.split('—')[0]?.trim() || ev.summary || 'Unknown';

  const statusMap: Record<string, string> = { confirmed: 'confirmed', tentative: 'pending', cancelled: 'cancelled' };
  const status = (ev.status && statusMap[ev.status]) || 'confirmed';

  return {
    id:        ev.id,
    patient,
    doctor,
    phone,
    reason,
    status,
    startISO:  ev.start?.dateTime || ev.start?.date,
    endISO:    ev.end?.dateTime   || ev.end?.date,
    time:      ev.start?.dateTime
      ? new Date(ev.start.dateTime).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '',
    calendarLink: ev.htmlLink || null,
    meetLink:     ev.conferenceData?.entryPoints?.[0]?.uri || null,
    source:       props.source || 'calendar',
  };
}

function addMinutes(isoStr: string, minutes: number): string {
  return new Date(new Date(isoStr).getTime() + minutes * 60000).toISOString();
}

function getMockAppointments() {
  const today = new Date().toISOString().split('T')[0];
  return [
    { id: 'a1', patient: 'Siti Rahayu',  doctor: 'Dr. Amirul Hadi',  phone: '+601112222333', reason: 'Blood pressure check', status: 'confirmed', time: '09:00', startISO: `${today}T09:00:00+08:00` },
    { id: 'a2', patient: 'James Lim',    doctor: 'Dr. Raj Kumar',     phone: '+601133334444', reason: 'Dental cleaning',     status: 'confirmed', time: '09:30', startISO: `${today}T09:30:00+08:00` },
    { id: 'a3', patient: 'Ahmad Fauzi',  doctor: 'Dr. Amirul Hadi',  phone: '+601112345678', reason: 'Fever & headache',    status: 'confirmed', time: '10:00', startISO: `${today}T10:00:00+08:00` },
    { id: 'a4', patient: 'Nurul Ain',    doctor: 'Dr. Siti Hajar',   phone: '+601155556666', reason: 'Child vaccination',   status: 'pending',   time: '10:30', startISO: `${today}T10:30:00+08:00` },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
router.get('/oauth/connect', (req: Request, res: Response) => {
  const { clientId } = req.query as Record<string, string | undefined>;
  if (!clientId) return res.status(400).json({ error: true, message: 'clientId is required.' });
  const auth = makeOAuth2Client();
  const url  = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: clientId,
  });
  logger.info(`Google OAuth redirect for client: ${clientId}`);
  res.redirect(url);
});

router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state: clientId, error } = req.query as Record<string, string | undefined>;
  if (error) {
    logger.error(`Google OAuth denied for client ${clientId}: ${error}`);
    return res.status(400).send(`OAuth error: ${error}`);
  }
  if (!code || !clientId) {
    return res.status(400).json({ error: true, message: 'Missing code or state param.' });
  }
  try {
    const auth = makeOAuth2Client();
    const { tokens } = await auth.getToken(code);
    await saveTokens(clientId, tokens as GoogleTokens);
    logger.info(`Google Calendar authorised for client: ${clientId}`);
    const origin = (process.env.ALLOWED_ORIGINS || '').split(',')[0] || 'http://localhost:3000';
    res.redirect(`${origin}?calendarConnected=true&clientId=${clientId}`);
  } catch (err) {
    const e = err as Error;
    logger.error('Google OAuth callback error', { err: e.message });
    res.status(500).json({ error: true, message: e.message });
  }
});

router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, date, timeMin, timeMax } = req.query as Record<string, string | undefined>;
    if (!clientId) return res.status(400).json({ error: true, message: 'clientId is required.' });

    const client = await clients.get(clientId);
    const calId  = client.google?.calendarId || process.env.GOOGLE_CALENDAR_ID || undefined;

    // Interpret `date` as a Malaysia-local day, NOT UTC. `new Date("2026-05-21")`
    // would parse as UTC midnight; instead we build the start/end of that local day.
    const TZ_OFFSET_HOURS = 8; // Asia/Kuala_Lumpur
    let start: string, end: string;
    if (timeMin && timeMax) {
      start = timeMin;
      end   = timeMax;
    } else {
      const dayStr = date || new Date(Date.now() + TZ_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
      // Build ISO strings explicitly so the day boundaries are Malaysia midnight.
      start = `${dayStr}T00:00:00+08:00`;
      end   = `${dayStr}T23:59:59+08:00`;
    }

    let events: ReturnType<typeof normaliseEvent>[] = [];
    try {
      const cal = await getCalendarClient(clientId);
      const resp = await cal.events.list({
        calendarId:   calId,
        timeMin:      start,
        timeMax:      end,
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   100,
      });
      events = (resp.data.items || []).map(normaliseEvent);
    } catch (authErr) {
      const e = authErr as HttpError;
      if (e.status === 401 || process.env.NODE_ENV === 'development') {
        logger.warn(`Calendar not authorised for ${clientId} — returning mock appointments`);
        return res.json({ appointments: getMockAppointments(), calendarId: calId, mock: true });
      }
      throw authErr;
    }

    res.json({
      appointments: events,
      calendarId:   calId,
      date:         date || new Date().toISOString().split('T')[0],
      total:        events.length,
    });
  } catch (err) { next(err); }
});

router.post('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, patient, phone, doctor, reason, startISO, endISO } = req.body || {};
    if (!clientId || !patient || !startISO) {
      return res.status(400).json({ error: true, message: 'clientId, patient, and startISO are required.' });
    }
    const client = await clients.get(clientId);
    const calId  = client.google?.calendarId || process.env.GOOGLE_CALENDAR_ID || undefined;
    const cal    = await getCalendarClient(clientId);

    const event = await cal.events.insert({
      calendarId: calId,
      requestBody: {
        summary: `${patient} — ${reason || 'Appointment'}`,
        description: `Patient: ${patient}\nPhone: ${phone || 'N/A'}\nDoctor: ${doctor || 'TBC'}\nReason: ${reason || 'N/A'}\nBooked via: FlowDesk`,
        start: { dateTime: startISO, timeZone: 'Asia/Kuala_Lumpur' },
        end:   { dateTime: endISO || addMinutes(startISO, 30), timeZone: 'Asia/Kuala_Lumpur' },
        extendedProperties: { private: { patientPhone: phone, doctor, source: 'flowdesk' } },
      },
    });

    logger.info(`Appointment created: ${event.data.id} for ${patient}`);
    res.status(201).json(normaliseEvent(event.data));
  } catch (err) { next(err); }
});

router.put('/appointments/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, startISO, endISO, reason } = req.body || {};
    if (!clientId || !startISO) {
      return res.status(400).json({ error: true, message: 'clientId and startISO are required.' });
    }
    const client = await clients.get(clientId);
    const calId  = client.google?.calendarId || process.env.GOOGLE_CALENDAR_ID || undefined;
    const cal    = await getCalendarClient(clientId);

    const existing = await cal.events.get({ calendarId: calId, eventId: String(req.params.eventId) });
    const updated = await cal.events.update({
      calendarId: calId,
      eventId:    String(req.params.eventId),
      requestBody: {
        ...existing.data,
        start: { dateTime: startISO, timeZone: 'Asia/Kuala_Lumpur' },
        end:   { dateTime: endISO || addMinutes(startISO, 30), timeZone: 'Asia/Kuala_Lumpur' },
        ...(reason ? { description: (existing.data.description || '') + `\nRescheduled via FlowDesk: ${reason}` } : {}),
      },
    });

    logger.info(`Appointment rescheduled: ${String(req.params.eventId)}`);
    res.json(normaliseEvent(updated.data));
  } catch (err) { next(err); }
});

router.delete('/appointments/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.query as Record<string, string | undefined>;
    if (!clientId) return res.status(400).json({ error: true, message: 'clientId is required.' });
    const client = await clients.get(clientId);
    const calId  = client.google?.calendarId || process.env.GOOGLE_CALENDAR_ID || undefined;
    const cal    = await getCalendarClient(clientId);
    await cal.events.delete({ calendarId: calId, eventId: String(req.params.eventId) });
    logger.info(`Appointment deleted: ${String(req.params.eventId)}`);
    res.json({ deleted: true, eventId: String(req.params.eventId) });
  } catch (err) { next(err); }
});

export default router;
