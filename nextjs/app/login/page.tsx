"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<"login" | "signup" | "loading">("loading");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  // Decide whether to show login or first-admin bootstrap
  useEffect(() => {
    fetch("/api/auth/status")
      .then(r => r.json())
      .then(d => setMode(d.bootstrap ? "signup" : "login"))
      .catch(() => setMode("login"));
  }, []);

  // If we already have a session, bounce to dashboard
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? router.replace("/") : null)
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("Email and password are required."); return; }
    if (mode === "signup" && password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setBusy(true);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body: Record<string, string> = { email, password };
      if (mode === "signup" && name.trim()) body.name = name.trim();

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Authentication failed.");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "loading") {
    return <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>Loading…</div>;
  }

  const isSignup = mode === "signup";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: 400, padding: 32, background: "var(--bg-surface)", border: "1px solid var(--border-2)", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 22 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,var(--accent),#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={17} color="var(--bg-base)" strokeWidth={2.5} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--text-strong)" }}>FlowDesk</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-strong)" }}>
            {isSignup ? "Create the first admin" : "Sign in"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted-2)", marginTop: 4 }}>
            {isSignup ? "This account becomes the owner of the dashboard." : "Use your admin credentials to continue."}
          </div>
        </div>

        <form onSubmit={submit}>
          {isSignup && (
            <Field icon={<User size={13} />} placeholder="Full name (optional)" value={name} onChange={setName} />
          )}
          <Field icon={<Mail size={13} />} placeholder="admin@example.com" value={email} onChange={setEmail} type="email" autoFocus={!isSignup} />
          <Field icon={<Lock size={13} />} placeholder={isSignup ? "Password (min 8 characters)" : "Password"} value={password} onChange={setPassword} type="password" />

          {error && (
            <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#ef4444", fontSize: 11.5, marginBottom: 10 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy}
                  style={{ width: "100%", padding: "10px 14px", background: busy ? "var(--border)" : "var(--accent)", border: "none", borderRadius: 8, color: busy ? "var(--text-muted-2)" : "var(--bg-base)", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Working…" : (isSignup ? "Create account" : "Sign in")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange, type = "text", autoFocus }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string; autoFocus?: boolean }) {
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>{icon}</div>
      <input
        type={type}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="fd-input"
        style={{ width: "100%", paddingLeft: 32, height: 36 }}
      />
    </div>
  );
}
