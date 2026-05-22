/**
 * routes/patients.ts — cross-system patient search aggregator.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { google, calendar_v3 } from 'googleapis';
import logger from '../config/logger';
import * as clients from '../config/clients';
import * as tokenStore from '../config/googleTokens';
import { HttpError } from '../types';

const router = Router();

const RETELL_BASE = process.env.RETELL_API_BASE || 'https://api.retellai.com';
const API_KEY     = process.env.RETELL_API_KEY  || '';

const PAST_WINDOW_MS   = 365 * 24 * 60 * 60 * 1000;
const FUTURE_WINDOW_MS = 182 * 24 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────
interface RetellTranscriptTurn { role?: string; content?: string }
interface RawCall {
  call_id: string;
  from_number?:      string;
  call_status?:      string;
  start_timestamp?:  number;
  end_timestamp?:    number;
  transcript?:       string | RetellTranscriptTurn[];
  transcript_object?: RetellTranscriptTurn[];
  recording_url?:    string;
  call_analysis?: {
    call_summary?:   string;
    user_sentiment?: string;
    custom_analysis_data?: Record<string, string | undefined>;
  };
  metadata?: Record<string, string | undefined>;
}

interface CallEntry {
  id:           string;
  startedAt:    string | null;
  durationSec:  number | null;
  status:       string | undefined;
  summary:      string;
  sentiment:    string | null;
  recordingUrl: string | null;
}

interface ApptEntry {
  id:           string | null | undefined;
  patient:      string | null;
  doctor:       string;
  reason:       string;
  status:       string;
  startISO:     string | null | undefined;
  endISO:       string | null | undefined;
  calendarLink: string | null;
}

interface PatientRecord {
  key:             string;
  names:           Set<string>;
  phones:          Set<string>;
  calls:           CallEntry[];
  appointments:    ApptEntry[];
  lastInteraction: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normPhone(p: string | null | undefined): string {
  if (!p) return '';
  return String(p).replace(/\D/g, '').slice(-10);
}

function asciiName(n: string | null | undefined): string {
  return (n || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim();
}

interface FetchOptions { method?: string; body?: string; headers?: Record<string, string> }

async function retellFetch(path: string, options: FetchOptions = {}): Promise<unknown> {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${RETELL_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const err: HttpError = new Error(`Retell API error ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function extractPatientName(raw: RawCall): string | null {
  const custom = raw.call_analysis?.custom_analysis_data || {};
  return (
    custom.patient_name ||
    custom.customer_name ||
    custom.caller_name ||
    custom.name ||
    raw.metadata?.patient_name ||
    null
  );
}

function nameFromTranscript(raw: RawCall): string | null {
  let userLines: string[] = [];
  if (Array.isArray(raw.transcript_object)) {
    userLines = raw.transcript_object
      .filter((t) => t.role && t.role.toLowerCase() === 'user')
      .map((t) => t.content || '');
  } else if (typeof raw.transcript === 'string') {
    userLines = raw.transcript
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => /^user:/i.test(l))
      .map((l) => l.replace(/^user:\s*/i, ''));
  }
  if (userLines.length === 0) return null;

  const STOP = new Set([
    'hi','hello','helo','ya','tak','ok','okay','betul','salah','baik','boleh',
    'saya','encik','puan','cik','tuan',
    'demam','batuk','sakit','perut','kepala',
    'esok','semalam','hari','ini','itu','nak','ada','tiada','tidak',
    'pagi','tengahari','petang','malam',
    'januari','februari','mac','april','mei','jun','julai','ogos','september','oktober','november','disember',
    'isnin','selasa','rabu','khamis','jumaat','sabtu','ahad',
  ]);

  const patterns = [
    /\bnama\s+saya\s+(?:adalah\s+)?([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3})/iu,
    /\bmy\s+name\s+is\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3})/iu,
    /\bthis\s+is\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3})/iu,
    /\bi'?m\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3})/iu,
    /\bsaya\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,3})/u,
  ];

  for (const line of userLines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (!m) continue;
      const candidate = m[1]!.trim();
      const firstWord = candidate.split(/\s+/)[0]!.toLowerCase();
      if (STOP.has(firstWord)) continue;
      return candidate;
    }
  }
  return null;
}

// ── Source loaders ───────────────────────────────────────────────────────────
async function loadCalls(clientId: string): Promise<RawCall[]> {
  const client  = await clients.get(clientId);
  const agentId = client.retell?.agentId;

  const body = {
    limit: 500,
    filter_criteria: {
      ...(agentId && !agentId.startsWith('agent_REPLACE') ? { agent_id: [agentId] } : {}),
    },
  };

  try {
    const data = await retellFetch('/v2/list-calls', { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(data) ? data : ((data as { call_list?: RawCall[] }).call_list || []);
  } catch (err) {
    logger.warn(`patients: Retell list-calls failed for ${clientId}: ${(err as Error).message}`);
    return [];
  }
}

async function loadAppointments(clientId: string): Promise<calendar_v3.Schema$Event[]> {
  const tokens = await tokenStore.load(clientId);
  if (!tokens) {
    logger.debug(`patients: no Google tokens for ${clientId}, skipping calendar`);
    return [];
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    auth.setCredentials(tokens);

    const client = await clients.get(clientId);
    const calId  = client.google?.calendarId || process.env.GOOGLE_CALENDAR_ID || undefined;
    const cal    = google.calendar({ version: 'v3', auth });
    const now    = Date.now();

    const resp = await cal.events.list({
      calendarId:   calId,
      timeMin:      new Date(now - PAST_WINDOW_MS).toISOString(),
      timeMax:      new Date(now + FUTURE_WINDOW_MS).toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   500,
    });
    return resp.data.items || [];
  } catch (err) {
    logger.warn(`patients: Google Calendar fetch failed for ${clientId}: ${(err as Error).message}`);
    return [];
  }
}

// ── Aggregation ──────────────────────────────────────────────────────────────
function buildPatientIndex(rawCalls: RawCall[], rawAppts: calendar_v3.Schema$Event[]): Map<string, PatientRecord> {
  const byKey = new Map<string, PatientRecord>();

  function bucket(key: string): PatientRecord {
    let rec = byKey.get(key);
    if (!rec) {
      rec = { key, names: new Set(), phones: new Set(), calls: [], appointments: [], lastInteraction: null };
      byKey.set(key, rec);
    }
    return rec;
  }

  for (const c of rawCalls) {
    const phone = normPhone(c.from_number);
    const name  = extractPatientName(c) || nameFromTranscript(c) || null;
    const key   = phone || (name ? `name:${asciiName(name)}` : null);
    if (!key) continue;

    const rec = bucket(key);
    if (name) rec.names.add(name);
    if (c.from_number) rec.phones.add(c.from_number);

    const startedAtMs = c.start_timestamp || null;
    rec.calls.push({
      id:        c.call_id,
      startedAt: startedAtMs ? new Date(startedAtMs).toISOString() : null,
      durationSec: (c.end_timestamp && c.start_timestamp)
        ? Math.round((c.end_timestamp - c.start_timestamp) / 1000) : null,
      status:       c.call_status,
      summary:      c.call_analysis?.call_summary || '',
      sentiment:    c.call_analysis?.user_sentiment || null,
      recordingUrl: c.recording_url || null,
    });

    if (startedAtMs && (!rec.lastInteraction || startedAtMs > rec.lastInteraction)) {
      rec.lastInteraction = startedAtMs;
    }
  }

  for (const ev of rawAppts) {
    const props = (ev.extendedProperties?.private || {}) as Record<string, string | undefined>;
    const desc  = ev.description || '';
    const phoneMatch = desc.match(/Phone:\s*(.+)/i);
    const phoneRaw   = props.patientPhone || (phoneMatch ? phoneMatch[1]!.trim() : null);
    const phone      = normPhone(phoneRaw);
    const patient = ev.summary?.split('—')[0]?.trim() || ev.summary || null;
    const key     = phone || (patient ? `name:${asciiName(patient)}` : null);
    if (!key) continue;

    const rec = bucket(key);
    if (patient)  rec.names.add(patient);
    if (phoneRaw) rec.phones.add(phoneRaw);

    const doctorMatch = desc.match(/Doctor:\s*(.+)/i);
    const reasonMatch = desc.match(/Reason:\s*(.+)/i);
    const startMs = ev.start?.dateTime ? new Date(ev.start.dateTime).getTime() : null;

    rec.appointments.push({
      id:       ev.id,
      patient,
      doctor:   props.doctor || (doctorMatch ? doctorMatch[1]!.trim() : 'TBC'),
      reason:   reasonMatch ? reasonMatch[1]!.trim() : (ev.summary || ''),
      status:   ev.status === 'cancelled' ? 'cancelled' : 'confirmed',
      startISO: ev.start?.dateTime || ev.start?.date,
      endISO:   ev.end?.dateTime   || ev.end?.date,
      calendarLink: ev.htmlLink || null,
    });

    if (startMs && (!rec.lastInteraction || startMs > rec.lastInteraction)) {
      rec.lastInteraction = startMs;
    }
  }

  return byKey;
}

function summariseRecord(rec: PatientRecord) {
  const primaryName  = rec.names.size  ? [...rec.names][0]  : null;
  const primaryPhone = rec.phones.size ? [...rec.phones][0] : null;
  return {
    key:              rec.key,
    name:             primaryName,
    aliases:          [...rec.names].filter((n) => n !== primaryName),
    phone:            primaryPhone,
    phones:           [...rec.phones],
    callCount:        rec.calls.length,
    appointmentCount: rec.appointments.length,
    upcomingCount:    rec.appointments.filter((a) => a.startISO && new Date(a.startISO) > new Date()).length,
    lastInteraction:  rec.lastInteraction ? new Date(rec.lastInteraction).toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, q = '', limit = '20' } = req.query as Record<string, string | undefined>;
    if (!clientId) {
      return res.status(400).json({ error: true, message: 'clientId is required.' });
    }

    const query = (q || '').trim().toLowerCase();
    const [rawCalls, rawAppts] = await Promise.all([loadCalls(clientId), loadAppointments(clientId)]);
    const index = buildPatientIndex(rawCalls, rawAppts);
    let records = [...index.values()];

    if (query) {
      const qDigits = query.replace(/\D/g, '');
      records = records.filter((r) => {
        const nameHit  = [...r.names].some((n) => asciiName(n).includes(asciiName(query)));
        const phoneHit = !!qDigits && [...r.phones].some((p) => normPhone(p).includes(qDigits));
        return nameHit || phoneHit;
      });
    }

    records.sort((a, b) => (b.lastInteraction || 0) - (a.lastInteraction || 0));

    res.json({
      query: q,
      total: records.length,
      results: records.slice(0, Number(limit)).map(summariseRecord),
    });
  } catch (err) { next(err); }
});

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, phone, name } = req.query as Record<string, string | undefined>;
    if (!clientId) {
      return res.status(400).json({ error: true, message: 'clientId is required.' });
    }
    if (!phone && !name) {
      return res.status(400).json({ error: true, message: 'phone or name query param is required.' });
    }

    const [rawCalls, rawAppts] = await Promise.all([loadCalls(clientId), loadAppointments(clientId)]);
    const index = buildPatientIndex(rawCalls, rawAppts);
    const key = phone ? normPhone(phone) : `name:${asciiName(name)}`;
    const rec = index.get(key);
    if (!rec) {
      return res.status(404).json({ error: true, message: 'Patient not found.' });
    }

    const now = Date.now();
    const upcoming = rec.appointments
      .filter((a) => a.startISO && new Date(a.startISO).getTime() >= now)
      .sort((a, b) => new Date(a.startISO!).getTime() - new Date(b.startISO!).getTime());
    const past = rec.appointments
      .filter((a) => a.startISO && new Date(a.startISO).getTime() < now)
      .sort((a, b) => new Date(b.startISO!).getTime() - new Date(a.startISO!).getTime());
    const callsSorted = rec.calls
      .filter((c) => c.startedAt)
      .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());

    res.json({
      info: {
        name:    rec.names.size  ? [...rec.names][0]  : null,
        aliases: [...rec.names].slice(1),
        phone:   rec.phones.size ? [...rec.phones][0] : null,
        phones:  [...rec.phones],
        lastInteraction: rec.lastInteraction ? new Date(rec.lastInteraction).toISOString() : null,
      },
      stats: {
        totalCalls:        rec.calls.length,
        totalAppointments: rec.appointments.length,
        upcomingCount:     upcoming.length,
        pastCount:         past.length,
      },
      upcomingAppointments: upcoming,
      pastAppointments:     past,
      calls:                callsSorted,
    });
  } catch (err) { next(err); }
});

export default router;
