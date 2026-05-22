"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, Calendar, Clock, User, X } from "lucide-react";
import { Appointment } from "@/lib/data";

interface Props {
  clientId: string;
}

const SOON_MS = 60 * 60 * 1000; // "starting soon" = next 60 minutes
const POLL_MS = 60 * 1000;      // re-fetch every minute

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMs < 0)         return "started";
  if (diffMin === 0)      return "now";
  if (diffMin === 1)      return "in 1 min";
  if (diffMin < 60)       return `in ${diffMin} min`;

  const sameDay = target.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = target.toDateString() === tomorrow.toDateString();

  const time = target.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay)    return `today at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return target.toLocaleString("en-MY", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationTray({ clientId }: Props) {
  const [open, setOpen]     = useState(false);
  const [items, setItems]   = useState<Appointment[]>([]);
  const [now, setNow]       = useState(new Date());
  const boxRef              = useRef<HTMLDivElement | null>(null);

  // Fetch today + tomorrow bookings, refresh every minute
  useEffect(() => {
    let cancelled = false;
    function load() {
      const today    = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const timeMin = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const timeMax = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
      fetch(`/api/calendar/appointments?clientId=${clientId}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) setItems(d.appointments || []); })
        .catch(() => { /* keep stale */ });
      if (!cancelled) setNow(new Date());
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [clientId]);

  // Click-outside closes tray
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Filter + sort by upcoming start time
  const upcoming = items
    .filter(a => a.startISO && new Date(a.startISO).getTime() >= now.getTime() - 5 * 60_000) // include things within last 5 min
    .map(a => ({ ...a, _start: new Date(a.startISO!) }))
    .sort((a, b) => a._start.getTime() - b._start.getTime());

  const soon       = upcoming.filter(a => a._start.getTime() - now.getTime() <= SOON_MS);
  const laterToday = upcoming.filter(a => {
    const isSoon = a._start.getTime() - now.getTime() <= SOON_MS;
    return !isSoon && isoDate(a._start) === isoDate(now);
  });
  const tomorrow = upcoming.filter(a => {
    const t = new Date(now); t.setDate(now.getDate() + 1);
    return isoDate(a._start) === isoDate(t);
  });

  const badgeCount = soon.length;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6 }}
      >
        <Bell size={16} color={open ? "var(--accent)" : "var(--text-faint)"} />
        {badgeCount > 0 && (
          <div style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 14, height: 14, padding: "0 4px",
            borderRadius: 7, background: "#ef4444",
            border: "1.5px solid var(--bg-surface)",
            color: "#fff", fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </div>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          width: 380, maxHeight: 480, overflow: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 250,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>Notifications</div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <X size={14} color="var(--text-muted-2)" />
            </button>
          </div>

          {/* Body */}
          {upcoming.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
              No upcoming bookings today or tomorrow.
            </div>
          ) : (
            <>
              <Group title="Starting soon" icon={<Clock size={11} color="#ef4444" />} highlight items={soon} now={now} empty="Nothing in the next 60 minutes." />
              <Group title="Later today"   icon={<Calendar size={11} color="var(--text-secondary)" />} items={laterToday} now={now} empty={null} />
              <Group title="Tomorrow"      icon={<Calendar size={11} color="var(--text-secondary)" />} items={tomorrow}   now={now} empty={null} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface GroupedAppt extends Appointment { _start: Date }

function Group({ title, icon, items, now, empty, highlight }: {
  title: string;
  icon: React.ReactNode;
  items: GroupedAppt[];
  now: Date;
  empty: string | null;
  highlight?: boolean;
}) {
  if (items.length === 0 && empty === null) return null;

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px 8px", fontSize: 10.5, color: "var(--text-muted-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {icon} {title} <span style={{ color: "var(--text-dim)" }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "4px 14px 6px", fontSize: 11, color: "var(--text-dim)" }}>{empty}</div>
      ) : items.map(a => (
        <div key={a.id} style={{
          padding: "8px 14px",
          background: highlight ? "rgba(239,68,68,0.06)" : "transparent",
          borderLeft: highlight ? "2px solid #ef4444" : "2px solid transparent",
          marginBottom: 1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500 }}>{a.patient || "Unknown contact"}</span>
            <span style={{ fontSize: 10.5, color: highlight ? "#ef4444" : "var(--text-muted-2)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {fmtRelative(a._start, now)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted-2)", marginTop: 2 }}>{a.reason || "Booking"}</div>
          {a.doctor && (
            <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>
              <User size={9} style={{ verticalAlign: -1, marginRight: 3 }} />{a.doctor}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
