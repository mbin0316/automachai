"use client";
import { useEffect, useState } from "react";
import { X, KeyRound, Users, Mail, UserPlus, Trash2, Sun, Moon, Palette } from "lucide-react";
import type { CurrentAdmin } from "@/app/page";
import { useTheme, type Theme } from "@/lib/theme";

interface AdminRow { id: string; email: string; name: string | null; role: string; createdAt: string }

export default function AccountModal({
  admin, onClose, onPasswordChanged,
}: {
  admin: CurrentAdmin;
  onClose: () => void;
  onPasswordChanged: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "preferences" | "team">("profile");

  return (
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: 560, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", background: "var(--bg-surface)", border: "1px solid var(--border-2)", borderRadius: 12 }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-strong)" }}>Account</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={16} color="var(--text-muted-2)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "0 22px", display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          <TabBtn active={tab === "profile"}     onClick={() => setTab("profile")}     icon={<KeyRound size={12} />} label="Profile" />
          <TabBtn active={tab === "preferences"} onClick={() => setTab("preferences")} icon={<Palette size={12} />}  label="Preferences" />
          <TabBtn active={tab === "team"}        onClick={() => setTab("team")}        icon={<Users size={12} />}    label="Team" />
        </div>

        <div style={{ padding: 22 }}>
          {tab === "profile"     && <ProfilePane    admin={admin} onPasswordChanged={onPasswordChanged} />}
          {tab === "preferences" && <PreferencesPane />}
          {tab === "team"        && <TeamPane       admin={admin} />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`, color: active ? "var(--text-strong)" : "var(--text-muted-2)", fontSize: 12, cursor: "pointer" }}>
      {icon}{label}
    </button>
  );
}

function ProfilePane({ admin, onPasswordChanged }: { admin: CurrentAdmin; onPasswordChanged: () => void }) {
  const [curr, setCurr]       = useState("");
  const [next, setNext]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (!curr || !next) { setMsg({ type: "err", text: "Both password fields are required." }); return; }
    if (next.length < 8) { setMsg({ type: "err", text: "New password must be at least 8 characters." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curr, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed.");
      setMsg({ type: "ok", text: "Password updated." });
      setCurr(""); setNext("");
      onPasswordChanged();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed." });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Signed in as</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 13, color: "var(--text-primary)" }}>
          <Mail size={12} color="var(--text-muted-2)" /> {admin.email}
        </div>
        {admin.name && <div style={{ fontSize: 11.5, color: "var(--text-muted-2)", marginTop: 4 }}>{admin.name}</div>}
        <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>{admin.role}</div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Change password</div>
      <PasswordInput placeholder="Current password" value={curr} onChange={setCurr} />
      <PasswordInput placeholder="New password (min 8 characters)" value={next} onChange={setNext} />
      {msg && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: msg.type === "ok" ? "var(--accent-dim)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "var(--accent-border)" : "rgba(239,68,68,0.3)"}`, borderRadius: 6, color: msg.type === "ok" ? "var(--accent)" : "#ef4444", fontSize: 11.5 }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={submit} disabled={busy}
                style={{ padding: "8px 16px", background: busy ? "var(--border)" : "var(--accent)", border: "none", borderRadius: 7, color: busy ? "var(--text-muted-2)" : "var(--bg-base)", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </div>
    </div>
  );
}

function TeamPane({ admin }: { admin: CurrentAdmin }) {
  const [rows, setRows]   = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function refresh() {
    fetch("/api/admins").then(r => r.json()).then(d => setRows(d.admins || []));
  }
  useEffect(refresh, []);

  async function invite() {
    setMsg(null);
    if (!email || !password) { setMsg({ type: "err", text: "Email and initial password are required." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed.");
      setMsg({ type: "ok", text: `${data.email} added.` });
      setEmail(""); setName(""); setPassword("");
      refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed." });
    } finally { setBusy(false); }
  }

  async function remove(r: AdminRow) {
    if (!confirm(`Remove admin ${r.email}?`)) return;
    const res = await fetch(`/api/admins/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to remove admin.");
      return;
    }
    refresh();
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Current admins ({rows.length})</div>
      <div style={{ marginBottom: 18 }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500 }}>{r.name || r.email}</div>
              {r.name && <div style={{ fontSize: 11, color: "var(--text-muted-2)" }}>{r.email}</div>}
            </div>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: r.role === "owner" ? "rgba(245,158,11,0.1)" : "var(--accent-dim)", color: r.role === "owner" ? "#f59e0b" : "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.role}</span>
            {r.id !== admin.id && (
              <button onClick={() => remove(r)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <Trash2 size={12} color="#ef4444" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        <UserPlus size={11} style={{ verticalAlign: -1, marginRight: 4 }} /> Invite new admin
      </div>
      <input className="fd-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      <input className="fd-input" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      <input className="fd-input" placeholder="Initial password (min 8 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      {msg && (
        <div style={{ marginTop: 4, padding: "8px 10px", background: msg.type === "ok" ? "var(--accent-dim)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "var(--accent-border)" : "rgba(239,68,68,0.3)"}`, borderRadius: 6, color: msg.type === "ok" ? "var(--accent)" : "#ef4444", fontSize: 11.5 }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button onClick={invite} disabled={busy}
                style={{ padding: "7px 14px", background: busy ? "var(--border)" : "var(--accent)", border: "none", borderRadius: 7, color: busy ? "var(--text-muted-2)" : "var(--bg-base)", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          {busy ? "Adding…" : "Add admin"}
        </button>
      </div>
    </div>
  );
}

function PasswordInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input className="fd-input" type="password" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
           style={{ width: "100%", marginBottom: 6 }} />
  );
}

function PreferencesPane() {
  const [theme, setTheme] = useTheme();

  const choices: { value: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "dark",  label: "Dark",  icon: <Moon size={14} />, desc: "Default. Easier on the eyes for long sessions." },
    { value: "light", label: "Light", icon: <Sun size={14} />,  desc: "Higher contrast for bright environments." },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        Theme
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {choices.map((c) => {
          const selected = theme === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setTheme(c.value)}
              style={{
                textAlign: "left",
                padding: 14,
                background: selected ? "var(--accent-dim)" : "var(--bg-card)",
                border: `1px solid ${selected ? "var(--accent-border)" : "var(--border-2)"}`,
                borderRadius: 10,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: selected ? "var(--accent)" : "var(--text-primary)" }}>
                {c.icon}
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</span>
                {selected && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>Active</span>}
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-muted-2)" }}>{c.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-dim)" }}>
        Saved to this browser. Other devices will follow their own system preference until you set it explicitly.
      </div>
    </div>
  );
}
