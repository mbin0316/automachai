"use client";
import { useState, useEffect } from "react";
import { PhoneCall, PhoneMissed, Mic, User, MessageSquare, Hash } from "lucide-react";
import { Call } from "@/lib/data";

export default function CallsTab({ clientId }: { clientId: string }) {
  const [calls,        setCalls]        = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [search,       setSearch]       = useState("");
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    setLoading(true);
    setCalls([]);
    setSelectedCall(null);
    fetch(`/api/retell/calls?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => setCalls(data.calls || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const q = search.toLowerCase();
  const filtered = calls.filter(c =>
    !search ||
    c.caller.toLowerCase().includes(q) ||
    (c.patientName || "").toLowerCase().includes(q) ||
    (c.outcome || "").toLowerCase().includes(q) ||
    (c.tool || "").toLowerCase().includes(q)
  );

  const statusColor = (s: string) => ({ completed: "var(--accent)", missed: "#ef4444", transferred: "#f59e0b", cancelled: "#ef4444" }[s as string] || "var(--text-muted)");
  const statusBg    = (s: string) => ({ completed: "var(--accent-dim)", missed: "rgba(239,68,68,0.1)", transferred: "rgba(245,158,11,0.1)", cancelled: "rgba(239,68,68,0.1)" }[s as string] || "var(--border)");

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "–";

  // API returns sentiment as 0-100; component logic expects 0-1
  const normSentiment = (s: number | null) => (s != null ? s / 100 : null);

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)" }}>
      {/* List */}
      <div style={{ width: 360, flexShrink: 0, background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
          <input
            className="fd-input"
            placeholder="Search calls…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading && <div style={{ padding: 20, color: "var(--text-dim)", fontSize: 12 }}>Loading calls…</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20, color: "var(--text-dim)", fontSize: 12 }}>No calls found.</div>}
          {filtered.map(call => (
            <div
              key={call.id}
              className={`call-row ${selectedCall?.id === call.id ? "active" : ""}`}
              onClick={() => setSelectedCall(call)}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, background: statusBg(call.status), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {call.status === "missed" ? <PhoneMissed size={14} color="#ef4444" /> : <PhoneCall size={14} color={statusColor(call.status)} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {call.patientName || <span style={{ fontFamily: "var(--font-mono)" }}>{call.caller}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{call.outcome || "–"}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{fmtTime(call.startedAt)}</div>
                <span className="badge" style={{ marginTop: 4, background: statusBg(call.status), color: statusColor(call.status) }}>
                  {call.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selectedCall ? (
          <>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{selectedCall.caller}</span>
                  <span className="badge" style={{ background: statusBg(selectedCall.status), color: statusColor(selectedCall.status) }}>{selectedCall.status}</span>
                  {selectedCall.tool && selectedCall.tool !== "–" && (
                    <span className="badge" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
                      <Hash size={9} /> {selectedCall.tool}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{fmtTime(selectedCall.startedAt)} · {selectedCall.duration} · {selectedCall.outcome || "–"}</div>
              </div>
              {normSentiment(selectedCall.sentiment) != null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Sentiment</div>
                  <div style={{
                    fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 700,
                    color: (normSentiment(selectedCall.sentiment) as number) > 0.7
                      ? "var(--accent)"
                      : (normSentiment(selectedCall.sentiment) as number) > 0.55
                        ? "#f59e0b"
                        : "#ef4444",
                  }}>
                    {Math.round((normSentiment(selectedCall.sentiment) as number) * 100)}%
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedCall.transcript.length === 0 ? (
                <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No transcript available.</div>
              ) : (
                selectedCall.transcript.map((msg, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, justifyContent: msg.role === "agent" ? "flex-start" : "flex-end" }}>
                    {msg.role === "agent" && (
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <Mic size={11} color="var(--accent)" />
                      </div>
                    )}
                    <div style={{
                      maxWidth: "72%", padding: "9px 12px",
                      borderRadius: msg.role === "agent" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                      background: msg.role === "agent" ? "var(--border)" : "var(--accent-dim)",
                      border: `1px solid ${msg.role === "agent" ? "var(--border-3)" : "var(--accent-border)"}`,
                    }}>
                      <div style={{ fontSize: 10, color: msg.role === "agent" ? "var(--accent)" : "#60a5fa", fontWeight: 600, marginBottom: 4 }}>
                        {msg.role === "agent" ? "AI Receptionist" : "Caller"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-bright)", lineHeight: 1.6 }}>{msg.content}</div>
                    </div>
                    {msg.role === "user" && (
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        <User size={11} color="#60a5fa" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
            <MessageSquare size={28} color="var(--border-2)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Select a call to view transcript</div>
          </div>
        )}
      </div>
    </div>
  );
}
