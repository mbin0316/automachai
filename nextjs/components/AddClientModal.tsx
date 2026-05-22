"use client";
import { useState } from "react";
import { X } from "lucide-react";

export default function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName]             = useState("");
  const [city, setCity]             = useState("");
  const [agentId, setAgentId]       = useState("");
  const [agentName, setAgentName]   = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          agentId:    agentId.trim()    || undefined,
          agentName:  agentName.trim()  || undefined,
          calendarId: calendarId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create client.");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: 460, background: "var(--bg-surface)", border: "1px solid var(--border-2)", borderRadius: 12, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-strong)" }}>Add Client</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={16} color="var(--text-muted-2)" />
          </button>
        </div>

        <Field label="Name *" value={name} onChange={setName} placeholder="Klinik Sunshine" />
        <Field label="City"   value={city} onChange={setCity} placeholder="Shah Alam" />
        <Field label="Retell agent ID" value={agentId} onChange={setAgentId} placeholder="agent_xxxxxxxxxxxxxxxxxxxxxx" mono />
        <Field label="Retell agent name" value={agentName} onChange={setAgentName} placeholder="Sunshine-Receptionist-v1" />
        <Field label="Google calendar ID" value={calendarId} onChange={setCalendarId} placeholder="someone@gmail.com" />

        {error && <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#ef4444", fontSize: 11.5 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose}
                  style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--border-2)", borderRadius: 7, color: "var(--text-muted-2)", fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
                  style={{ padding: "7px 16px", background: busy ? "var(--border)" : "var(--accent)", border: "none", borderRadius: 7, color: busy ? "var(--text-muted-2)" : "var(--bg-base)", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Creating…" : "Create Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <input
        className="fd-input"
        style={{ width: "100%", fontFamily: mono ? "var(--font-mono)" : undefined }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
