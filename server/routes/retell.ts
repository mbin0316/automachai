/**
 * routes/retell.ts — All Retell AI data endpoints (proxy that keeps the API key server-side).
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import * as clients from '../config/clients';
import { HttpError } from '../types';

const router = Router();

const RETELL_BASE = process.env.RETELL_API_BASE || 'https://api.retellai.com';
const API_KEY     = process.env.RETELL_API_KEY  || '';

// ── Types for Retell responses ───────────────────────────────────────────────
interface RetellTranscriptTurn { role?: string; content?: string; words?: unknown[] }
interface RetellCallRaw {
  call_id:           string;
  agent_id?:         string;
  call_status?:      string;
  from_number?:      string;
  to_number?:        string;
  start_timestamp?:  number;
  end_timestamp?:    number;
  transcript?:       string | RetellTranscriptTurn[];
  transcript_object?: RetellTranscriptTurn[];
  recording_url?:    string;
  disconnection_reason?: string;
  call_analysis?: {
    user_sentiment?: 'positive' | 'neutral' | 'negative';
    call_summary?:   string;
    custom_analysis_data?: Record<string, string | undefined>;
  };
  metadata?: Record<string, string | undefined>;
}
interface RetellListResponse { call_list?: RetellCallRaw[]; pagination_key?: string }

interface NormalisedTurn { role: 'agent' | 'user'; content: string; words: unknown[] }
interface NormalisedCall {
  id:             string;
  caller:         string;
  callee:         string;
  agentId?:       string;
  status:         string;
  durationSec:    number | null;
  duration:       string;
  tool:           string;
  patientName:    string | null;
  outcome:        string;
  sentiment:      number | null;
  startedAt:      string | null;
  endedAt:        string | null;
  transcript:     NormalisedTurn[];
  recordingUrl:   string | null;
  disconnectionReason: string | null;
}

interface RetellFetchOptions {
  method?:  string;
  body?:    string;
  headers?: Record<string, string>;
}

async function retellFetch(path: string, options: RetellFetchOptions = {}): Promise<unknown> {
  const { default: fetch } = await import('node-fetch');
  const url = `${RETELL_BASE}${path}`;
  const res = await fetch(url, {
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

function normaliseTranscript(raw: string | RetellTranscriptTurn[] | undefined): NormalisedTurn[] {
  if (Array.isArray(raw)) {
    return raw.map((turn) => ({
      role: turn.role === 'agent' ? 'agent' : 'user',
      content: turn.content || '',
      words: turn.words || [],
    }));
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const m = line.match(/^(Agent|User|Assistant):\s*(.*)$/i);
      if (!m) return { role: 'user' as const, content: line, words: [] };
      return {
        role: /agent|assistant/i.test(m[1]!) ? ('agent' as const) : ('user' as const),
        content: m[2]!,
        words: [],
      };
    });
  }
  return [];
}

function normaliseCall(raw: RetellCallRaw): NormalisedCall {
  const statusMap: Record<string, string> = {
    ended:       'completed',
    error:       'failed',
    no_answer:   'missed',
    transferred: 'transferred',
    in_progress: 'live',
  };

  const customRaw = raw.call_analysis?.custom_analysis_data || {};
  const rawOutcome =
    customRaw.outcome ||
    customRaw.tool_used ||
    customRaw.action ||
    raw.metadata?.retell_tool ||
    raw.metadata?.last_tool ||
    null;
  const tool = rawOutcome
    ? String(rawOutcome).trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '–';

  const sentimentScore = raw.call_analysis?.user_sentiment
    ? ({ positive: 85, neutral: 60, negative: 35 } as const)[raw.call_analysis.user_sentiment] ?? null
    : null;

  const durationSec = raw.end_timestamp && raw.start_timestamp
    ? Math.round((raw.end_timestamp - raw.start_timestamp) / 1000)
    : null;
  const durationFmt = durationSec != null
    ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
    : '–';

  const patientName =
    customRaw.patient_name ||
    customRaw.customer_name ||
    customRaw.caller_name ||
    customRaw.name ||
    raw.metadata?.patient_name ||
    null;

  return {
    id:           raw.call_id,
    caller:       raw.from_number || 'Unknown',
    callee:       raw.to_number   || 'Unknown',
    agentId:      raw.agent_id,
    status:       (raw.call_status && statusMap[raw.call_status]) || raw.call_status || 'unknown',
    durationSec,
    duration:     durationFmt,
    tool,
    patientName,
    outcome:      raw.call_analysis?.call_summary || raw.metadata?.outcome || '',
    sentiment:    sentimentScore,
    startedAt:    raw.start_timestamp ? new Date(raw.start_timestamp).toISOString() : null,
    endedAt:      raw.end_timestamp   ? new Date(raw.end_timestamp).toISOString()   : null,
    transcript:   normaliseTranscript(raw.transcript_object || raw.transcript || []),
    recordingUrl: raw.recording_url || null,
    disconnectionReason: raw.disconnection_reason || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
router.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, limit = 50, paginationKey, startDate, endDate } = req.query as Record<string, string | undefined>;

    if (!clientId) {
      return res.status(400).json({ error: true, message: 'clientId query param is required.' });
    }

    const client  = await clients.get(clientId);
    const agentId = client.retell?.agentId;

    const startTs = (startDate || endDate) ? {
      ...(startDate ? { lower_threshold: new Date(startDate).getTime() } : {}),
      ...(endDate   ? { upper_threshold: new Date(endDate).getTime()   } : {}),
    } : null;

    const body = {
      limit: Math.min(Number(limit), 200),
      filter_criteria: {
        ...(agentId && !agentId.startsWith('agent_REPLACE') ? { agent_id: [agentId] } : {}),
        ...(startTs ? { start_timestamp: startTs } : {}),
      },
      ...(paginationKey ? { pagination_key: paginationKey } : {}),
    };

    logger.debug('Retell list-calls', { clientId, agentId, limit });

    const data = await retellFetch('/v2/list-calls', { method: 'POST', body: JSON.stringify(body) });
    const callList: RetellCallRaw[] = Array.isArray(data) ? data : ((data as RetellListResponse).call_list || []);
    res.json({
      calls:         callList.map(normaliseCall),
      paginationKey: (data as RetellListResponse).pagination_key || null,
      total:         callList.length,
    });
  } catch (err) { next(err); }
});

router.get('/calls/:callId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = await retellFetch(`/v2/get-call/${req.params.callId}`) as RetellCallRaw;
    res.json(normaliseCall(raw));
  } catch (err) { next(err); }
});

router.get('/calls/:callId/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw  = await retellFetch(`/v2/get-call/${req.params.callId}`) as RetellCallRaw;
    const call = normaliseCall(raw);
    const text = call.transcript.map((t) => `[${t.role.toUpperCase()}] ${t.content}`).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (err) { next(err); }
});

router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, period = 'today' } = req.query as Record<string, string | undefined>;
    if (!clientId) {
      return res.status(400).json({ error: true, message: 'clientId is required.' });
    }

    const now = new Date();

    // ── Time window for the Retell list-calls fetch ────────────────────────
    // period=today => rolling 24 hours (NOT midnight-to-now)
    // period=week  => rolling 7 days (last 7 calendar days, aligned to local midnight start of day -6)
    // period=month => last 30 days
    let windowStart: Date;
    if (period === 'week') {
      windowStart = new Date(now);
      windowStart.setDate(now.getDate() - 6);
      windowStart.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      windowStart = new Date(now);
      windowStart.setDate(now.getDate() - 29);
      windowStart.setHours(0, 0, 0, 0);
    } else {
      windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const client  = await clients.get(clientId);
    const agentId = client.retell?.agentId;

    const data = await retellFetch('/v2/list-calls', {
      method: 'POST',
      body: JSON.stringify({
        limit: 200,
        filter_criteria: {
          ...(agentId && !agentId.startsWith('agent_REPLACE') ? { agent_id: [agentId] } : {}),
          start_timestamp: { lower_threshold: windowStart.getTime(), upper_threshold: now.getTime() },
        },
      }),
    });
    const callList: RetellCallRaw[] = Array.isArray(data) ? data : ((data as RetellListResponse).call_list || []);
    const calls = callList.map(normaliseCall);

    const BOOKED_OUTCOMES = new Set(['book_appointment', 'booked', 'booking', 'appointment_booked', 'appointment_made']);
    const total   = calls.length;
    const booked  = calls.filter((c) => BOOKED_OUTCOMES.has(c.tool) && c.status === 'completed').length;
    const missed  = calls.filter((c) => c.status === 'missed').length;
    const validDurations = calls.filter((c) => c.durationSec != null) as (NormalisedCall & { durationSec: number })[];
    const avgDurSec = validDurations.reduce((a, c) => a + c.durationSec, 0) / (validDurations.length || 1);

    const toolCounts: Record<string, number> = {};
    calls.forEach((c) => {
      if (c.tool && c.tool !== '–') toolCounts[c.tool] = (toolCounts[c.tool] || 0) + 1;
    });

    // ── Build buckets ──────────────────────────────────────────────────────
    // The `hour` field is reused for both period shapes — frontend treats it
    // as an X-axis label string (could be "14:00" for hourly, "Mon" for daily).
    interface Bucket { hour: string; start: number; end: number; calls: number; booked: number; missed: number }

    let buckets: Bucket[];

    if (period === 'today') {
      // 24 hourly buckets ending at the current hour.
      buckets = Array.from({ length: 24 }, (_, i) => {
        const slot = new Date(now);
        slot.setMinutes(0, 0, 0);
        slot.setHours(now.getHours() - 23 + i);
        const slotEnd = new Date(slot);
        slotEnd.setHours(slot.getHours() + 1);
        return {
          hour:   `${String(slot.getHours()).padStart(2, '0')}:00`,
          start:  slot.getTime(),
          end:    slotEnd.getTime(),
          calls: 0, booked: 0, missed: 0,
        };
      });
    } else if (period === 'week') {
      // 7 daily buckets ending today. Today's bucket spans midnight → now.
      buckets = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(now.getDate() - 6 + i);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        const isToday = i === 6;
        return {
          hour:   isToday ? 'Today' : day.toLocaleDateString('en-MY', { weekday: 'short' }),
          start:  day.getTime(),
          end:    isToday ? now.getTime() : nextDay.getTime(),
          calls: 0, booked: 0, missed: 0,
        };
      });
    } else {
      // month or anything else: 30 daily buckets ending today
      buckets = Array.from({ length: 30 }, (_, i) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(now.getDate() - 29 + i);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        const isToday = i === 29;
        return {
          hour:   day.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }),
          start:  day.getTime(),
          end:    isToday ? now.getTime() : nextDay.getTime(),
          calls: 0, booked: 0, missed: 0,
        };
      });
    }

    // Place each call into the right bucket.
    for (const c of calls) {
      if (!c.startedAt) continue;
      const t = new Date(c.startedAt).getTime();
      const idx = buckets.findIndex((b) => t >= b.start && t < b.end);
      if (idx < 0) continue;
      buckets[idx]!.calls += 1;
      if (BOOKED_OUTCOMES.has(c.tool)) buckets[idx]!.booked += 1;
      if (c.status === 'missed')       buckets[idx]!.missed += 1;
    }

    // Drop internal timestamps before returning.
    const hourly = buckets.map(({ hour, calls, booked, missed }) => ({ hour, calls, booked, missed }));

    res.json({
      summary: {
        total, booked, missed,
        bookingRate:   total ? Math.round((booked / total) * 100) : 0,
        avgDurationSec: Math.round(avgDurSec),
        avgDurationFmt: `${Math.floor(avgDurSec / 60)}m ${Math.round(avgDurSec % 60)}s`,
      },
      toolDistribution: Object.entries(toolCounts)
        .map(([tool, count]) => ({ tool, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count),
      hourly,
      period,
      generatedAt: now.toISOString(),
    });
  } catch (err) { next(err); }
});

router.get('/agents', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await retellFetch('/list-agents', { method: 'GET' });
    const agentList = Array.isArray(data) ? data : ((data as { agent_list?: unknown[] }).agent_list || []);
    res.json({ agents: agentList });
  } catch (err) { next(err); }
});

export default router;
