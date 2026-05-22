"use client";
import { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Appointment } from "@/lib/data";
import MiniCalendar from "./MiniCalendar";

// Default business-hour window when there are no appointments. Once bookings exist
// the displayed range expands to fit them all.
const DEFAULT_HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];

const STATUS_COLOR: Record<string, string> = {
  confirmed:   "var(--accent)",
  pending:     "#f59e0b",
  rescheduled: "#a78bfa",
  cancelled:   "#ef4444",
};

// Use LOCAL date components, not toISOString() (which would shift by tz offset
// and silently put a 1am-Kuala-Lumpur moment on "yesterday").
function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Snap "HH:MM" or "H:MM" to the nearest 30-minute slot string ("HH:MM"). */
function snapToHalfHour(t: string): string | null {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mins = Math.max(0, Math.min(59, Number(m[2])));
  const snapped = mins < 15 ? 0 : mins < 45 ? 30 : 60;
  let hh = h;
  let mm = snapped;
  if (snapped === 60) { mm = 0; hh = (hh + 1) % 24; }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Add half-hour steps between a min and max time slot, inclusive. */
function rangeHalfHourly(minSlot: string, maxSlot: string): string[] {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = toMin(minSlot);
  const end   = toMin(maxSlot);
  const out: string[] = [];
  for (let m = start; m <= end; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export default function CalendarTab({ clientId }: { clientId: string }) {
  const [date,         setDate]         = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  // Set of YYYY-MM-DD strings (local time) that have ≥1 appointment in the current month
  const [markedDates,  setMarkedDates]  = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar/appointments?clientId=${clientId}&date=${toDateStr(date)}`)
      .then(r => r.json())
      .then(data => setAppointments(data.appointments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId, toDateStr(date)]);

  // Fetch the entire visible month so the mini-calendar can show "has appointment" dots.
  function loadMonth(firstDay: Date) {
    const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1).toISOString();
    const end   = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0, 23, 59, 59).toISOString();
    fetch(`/api/calendar/appointments?clientId=${clientId}&timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}`)
      .then(r => r.json())
      .then(data => {
        const dates = new Set<string>();
        for (const a of (data.appointments || []) as Appointment[]) {
          if (a.startISO) {
            const d = new Date(a.startISO);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            dates.add(`${y}-${m}-${day}`);
          }
        }
        setMarkedDates(dates);
      })
      .catch(() => setMarkedDates(new Set()));
  }

  // Snap every appointment to its nearest 30-min slot. Store the snapped value
  // on a derived copy so the rendering loop matches reliably.
  const snappedAppts = appointments.map(a => ({
    ...a,
    snappedTime: a.startISO ? snapToHalfHour(
      new Date(a.startISO).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false }),
    ) : (a.time ? snapToHalfHour(a.time) : null),
  }));

  // Group appointments by their assigned staff member ("doctor" is the storage
  // field, but UI calls it "Assigned to" so the dashboard works for any industry).
  const assignees = Array.from(new Set(snappedAppts.map(a => a.doctor))).filter(Boolean);
  const hasAppointments = snappedAppts.length > 0;
  const columns = hasAppointments ? assignees : ["Unassigned"];

  // Build a dynamic slot list that always covers every booking, even outside
  // business hours. Empty days fall back to a standard 8am–6pm window.
  const slotTimes: string[] = (() => {
    const fromAppts = snappedAppts.map(a => a.snappedTime).filter(Boolean) as string[];
    if (fromAppts.length === 0) return DEFAULT_HOURS;
    const sorted = [...fromAppts].sort();
    const min = sorted[0] < "08:00" ? sorted[0] : "08:00";
    const max = sorted[sorted.length - 1] > "18:00" ? sorted[sorted.length - 1] : "18:00";
    return rangeHalfHourly(min, max);
  })();

  const statsConfig = [
    { label: "Total",       filter: (_: Appointment) => true,                       color: "var(--text-secondary)" },
    { label: "Confirmed",   filter: (a: Appointment) => a.status === "confirmed",   color: "var(--accent)" },
    { label: "Pending",     filter: (a: Appointment) => a.status === "pending",     color: "#f59e0b" },
    { label: "Rescheduled", filter: (a: Appointment) => a.status === "rescheduled", color: "#a78bfa" },
  ];

  const prevDay = () => setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  const nextDay = () => setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={prevDay} style={{ background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 6, padding: "4px 8px", color: "var(--text-muted)", cursor: "pointer" }}>
            <ChevronLeft size={14} />
          </button>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text-strong)" }}>
              {date.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              {loading ? "Loading…" : `${appointments.length} ${appointments.length === 1 ? "booking" : "bookings"} scheduled`}
            </div>
          </div>
          <button onClick={nextDay} style={{ background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 6, padding: "4px 8px", color: "var(--text-muted)", cursor: "pointer" }}>
            <ChevronRight size={14} />
          </button>
        </div>
        <button className="btn btn-primary"><Plus size={12} /> New Booking</button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12 }}>
        {statsConfig.map(s => (
          <div key={s.label} style={{ padding: "10px 16px", background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 9, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{s.label}</span>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: s.color }}>
              {appointments.filter(s.filter).length}
            </span>
          </div>
        ))}
      </div>

      {/* Day grid + mini calendar sidebar */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>

        {/* Calendar grid (left, fills remaining space) */}
        <div style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Assignee column headers */}
        <div style={{ display: "grid", gridTemplateColumns: `70px repeat(${columns.length}, 1fr)`, borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "10px 12px", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Time</div>
          {columns.map(d => (
            <div key={d} style={{ padding: "10px 14px", borderLeft: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: hasAppointments ? "var(--text-secondary)" : "var(--text-dim)" }}>{d}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                {hasAppointments ? `${appointments.filter(a => a.doctor === d).length} bookings` : "No bookings today"}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {slotTimes.map(h => {
            const slotAppts = snappedAppts.filter(a => a.snappedTime === h);
            return (
              <div key={h} style={{ display: "grid", gridTemplateColumns: `70px repeat(${columns.length}, 1fr)`, borderBottom: "1px solid var(--border)", minHeight: 64 }}>
                <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", borderRight: "1px solid var(--border)" }}>{h}</div>
                {columns.map(col_name => {
                  const cellAppts = hasAppointments ? slotAppts.filter(a => a.doctor === col_name) : [];
                  return (
                    <div key={col_name} style={{ borderLeft: "1px solid var(--border)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {cellAppts.map((appt) => {
                        const col = STATUS_COLOR[appt.status] || "var(--text-muted)";
                        return (
                          <div key={appt.id} className="appt-card" style={{ borderLeftColor: col }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2 }}>{appt.patient}</div>
                              <span className="badge" style={{ background: col + "20", color: col, fontSize: 10, whiteSpace: "nowrap" }}>{appt.status}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-bright)" }}>{appt.reason}</div>
                            <div style={{ fontSize: 10.5, color: "var(--text-muted-2)", fontFamily: "var(--font-mono)", marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                              {appt.time && <span>{appt.time}</span>}
                              {appt.time && appt.phone && <span style={{ color: "var(--text-dim)" }}>·</span>}
                              {appt.phone && <span>{appt.phone}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>

        {/* Right sidebar — mini calendar */}
        <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <MiniCalendar
            selectedDate={date}
            onSelect={(d) => setDate(d)}
            markedDates={markedDates}
            onMonthChange={loadMonth}
          />
        </div>
      </div>
    </div>
  );
}
