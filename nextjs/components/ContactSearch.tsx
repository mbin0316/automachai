"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X, Phone, Calendar as CalIcon, User, Clock } from "lucide-react";

interface SearchResult {
  key: string;
  name: string | null;
  aliases: string[];
  phone: string | null;
  phones: string[];
  callCount: number;
  appointmentCount: number;
  upcomingCount: number;
  lastInteraction: string | null;
}

interface CallRow {
  id: string;
  startedAt: string | null;
  durationSec: number | null;
  status: string;
  summary: string;
  sentiment: string | null;
  recordingUrl: string | null;
}

// `patient` and `doctor` are the storage field names from the backend (which in turn
// reflect the calendar event format). They're not displayed as labels — UI calls them
// "Contact" and "Assigned to" so the dashboard reads naturally for any industry.
interface BookingRow {
  id: string;
  patient: string | null;
  doctor: string;
  reason: string;
  status: string;
  startISO: string;
  endISO: string;
  calendarLink: string | null;
}

interface Profile {
  info: {
    name: string | null;
    aliases: string[];
    phone: string | null;
    phones: string[];
    lastInteraction: string | null;
  };
  stats: {
    totalCalls: number;
    totalAppointments: number;
    upcomingCount: number;
    pastCount: number;
  };
  upcomingAppointments: BookingRow[];
  pastAppointments: BookingRow[];
  calls: CallRow[];
}

export default function ContactSearch({ clientId }: { clientId: string }) {
  const [q, setQ]                 = useState("");
  const [results, setResults]     = useState<SearchResult[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const boxRef                    = useRef<HTMLDivElement | null>(null);

  // Debounced search
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/patients/search?clientId=${clientId}&q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => setResults(d.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, clientId]);

  // Click-outside closes dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function openProfile(r: SearchResult) {
    setOpen(false);
    setProfile(null);
    setProfileLoading(true);
    const params = new URLSearchParams({ clientId });
    if (r.phone) params.set("phone", r.phone);
    else if (r.name) params.set("name", r.name);
    fetch(`/api/patients/profile?${params}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "–";
  const fmtDur  = (s: number | null) => s == null ? "–" : `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <>
      <div ref={boxRef} style={{ position: "relative" }}>
        <Search size={13} color="var(--text-dim)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <input
          className="fd-input"
          style={{ paddingLeft: 30, width: 240 }}
          placeholder="Search contacts by name or phone…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />

        {open && q.trim() && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, width: 360, maxHeight: 420, overflow: "auto", background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 100 }}>
            {loading && <div style={{ padding: 14, fontSize: 12, color: "var(--text-dim)" }}>Searching…</div>}
            {!loading && results.length === 0 && <div style={{ padding: 14, fontSize: 12, color: "var(--text-dim)" }}>No contacts match “{q}”.</div>}
            {results.map(r => (
              <div key={r.key} onClick={() => openProfile(r)}
                style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.name || "Unknown"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted-2)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{r.phone || "no phone"}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10.5, color: "var(--text-dim)" }}>
                  <span><Phone size={10} style={{ verticalAlign: -1 }} /> {r.callCount}</span>
                  <span><CalIcon size={10} style={{ verticalAlign: -1 }} /> {r.appointmentCount}</span>
                  {r.upcomingCount > 0 && <span style={{ color: "var(--accent)" }}>{r.upcomingCount} upcoming</span>}
                  <span style={{ marginLeft: "auto" }}>{r.lastInteraction ? new Date(r.lastInteraction).toLocaleDateString() : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile drawer */}
      {(profile || profileLoading) && (
        <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
             onClick={() => { setProfile(null); setProfileLoading(false); }}>
          <div onClick={e => e.stopPropagation()}
               style={{ width: 560, maxWidth: "100vw", background: "var(--bg-surface)", borderLeft: "1px solid var(--border-2)", height: "100vh", overflow: "auto", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Contact Profile</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-strong)", fontFamily: "var(--font-display)", marginTop: 4 }}>
                  {profileLoading ? "Loading…" : (profile?.info.name || "Unknown")}
                </div>
                {profile?.info.phone && (
                  <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-bright)", marginTop: 4 }}>
                    <Phone size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                    {profile.info.phone}
                  </div>
                )}
                {profile && profile.info.aliases.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                    Also known as: {profile.info.aliases.join(", ")}
                  </div>
                )}
              </div>
              <button onClick={() => { setProfile(null); setProfileLoading(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} color="var(--text-muted-2)" />
              </button>
            </div>

            {profile && (
              <>
                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
                  <Stat label="Calls"      value={profile.stats.totalCalls} />
                  <Stat label="Bookings"   value={profile.stats.totalAppointments} />
                  <Stat label="Upcoming"   value={profile.stats.upcomingCount} accent="var(--accent)" />
                  <Stat label="Past"       value={profile.stats.pastCount} />
                </div>

                {/* Upcoming */}
                <Section title="Upcoming bookings" count={profile.upcomingAppointments.length} icon={<CalIcon size={12} />}>
                  {profile.upcomingAppointments.length === 0
                    ? <Empty>No upcoming bookings.</Empty>
                    : profile.upcomingAppointments.map(a => <BookingCard key={a.id} a={a} />)}
                </Section>

                {/* Past */}
                <Section title="Past bookings" count={profile.pastAppointments.length} icon={<CalIcon size={12} />}>
                  {profile.pastAppointments.length === 0
                    ? <Empty>No past bookings.</Empty>
                    : profile.pastAppointments.map(a => <BookingCard key={a.id} a={a} past />)}
                </Section>

                {/* Calls */}
                <Section title="Call history" count={profile.calls.length} icon={<Phone size={12} />}>
                  {profile.calls.length === 0
                    ? <Empty>No call records.</Empty>
                    : profile.calls.map(c => (
                      <div key={c.id} style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--text-bright)" }}>
                            <Clock size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
                            {fmtDate(c.startedAt)}
                          </span>
                          <span style={{ fontSize: 10.5, color: "var(--text-muted-2)" }}>{fmtDur(c.durationSec)} · {c.status}</span>
                        </div>
                        {c.summary && <div style={{ fontSize: 11.5, color: "var(--text-bright)", lineHeight: 1.45 }}>{c.summary}</div>}
                        {c.recordingUrl && (
                          <a href={c.recordingUrl} target="_blank" rel="noreferrer"
                             style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, color: "#7aa6ff" }}>
                            Recording ↗
                          </a>
                        )}
                      </div>
                    ))}
                </Section>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "var(--text-strong)", fontFamily: "var(--font-display)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 11, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {icon}{title} <span style={{ color: "var(--text-dim)" }}>({count})</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: "var(--text-dim)", padding: "8px 0" }}>{children}</div>;
}

function BookingCard({ a, past }: { a: BookingRow; past?: boolean }) {
  const dt = a.startISO ? new Date(a.startISO) : null;
  return (
    <div style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8, opacity: past ? 0.85 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{a.reason || "Booking"}</span>
        <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 6, background: a.status === "cancelled" ? "rgba(239,68,68,0.1)" : "var(--accent-dim)", color: a.status === "cancelled" ? "#ef4444" : "var(--accent)" }}>{a.status}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted-2)" }}>
        <User size={10} style={{ verticalAlign: -1, marginRight: 4 }} />Assigned to: {a.doctor}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted-2)", marginTop: 2 }}>
        <CalIcon size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
        {dt ? dt.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "–"}
      </div>
      {a.calendarLink && (
        <a href={a.calendarLink} target="_blank" rel="noreferrer"
           style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, color: "#7aa6ff" }}>
          Open in Calendar ↗
        </a>
      )}
    </div>
  );
}
