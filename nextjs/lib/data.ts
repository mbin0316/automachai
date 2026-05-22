// lib/data.ts — TypeScript types

export interface Client {
  id: string; name: string; city: string;
  status: "active" | "warning" | "inactive";
  agentName: string; agentId: string;
}

export interface TranscriptLine { role: "agent" | "user"; content: string; }

export interface Call {
  id: string; caller: string; duration: string;
  status: string;
  tool: string; startedAt: string | null; outcome: string;
  sentiment: number | null;
  patientName?: string | null;
  transcript: TranscriptLine[];
}

export interface Appointment {
  id: string; time: string; patient: string; doctor: string;
  reason: string; status: string;
  phone: string | null; startISO: string;
}
