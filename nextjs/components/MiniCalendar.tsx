"use client";
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  /** Set of YYYY-MM-DD strings that should show an appointment dot. */
  markedDates?: Set<string>;
  /** Called when the visible month changes — useful to refetch month data. */
  onMonthChange?: (firstDay: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(d: Date) {
  // local-date string YYYY-MM-DD (NOT toISOString which shifts to UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MiniCalendar({ selectedDate, onSelect, markedDates, onMonthChange }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  // If parent changes selectedDate to a different month, follow it
  useEffect(() => {
    if (selectedDate.getFullYear() !== viewMonth.getFullYear() || selectedDate.getMonth() !== viewMonth.getMonth()) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Notify parent about month transitions for data fetching
  useEffect(() => {
    onMonthChange?.(viewMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth.getFullYear(), viewMonth.getMonth()]);

  const days = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    // ISO week starts on Monday — shift so Monday=0 .. Sunday=6
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);

    // Render 6 rows × 7 = 42 cells
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const today = new Date();

  const prev = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const next = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, padding: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prev} style={navBtn} title="Previous month">
          <ChevronLeft size={14} color="var(--text-muted-2)" />
        </button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>
          {viewMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
        </div>
        <button onClick={next} style={navBtn} title="Next month">
          <ChevronRight size={14} color="var(--text-muted-2)" />
        </button>
      </div>

      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{
            textAlign: "center", fontSize: 10, fontWeight: 600, padding: "4px 0",
            color: i >= 5 ? "#ef4444aa" : "var(--accent)aa", letterSpacing: 0.5,
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((d, i) => {
          const inMonth   = d.getMonth() === viewMonth.getMonth();
          const isToday   = sameDay(d, today);
          const isWeekend = i % 7 >= 5;
          const isSelected = sameDay(d, selectedDate);
          const hasMark   = markedDates?.has(ymd(d));

          const color =
            !inMonth ? "var(--text-dim)" :
            isWeekend ? "#f87171" :
            "var(--text-bright)";

          const bg =
            isSelected ? "var(--accent)" :
            isToday    ? "var(--accent-ring)" :
            "transparent";

          const textColor = isSelected ? "var(--bg-base)" : color;

          return (
            <button
              key={i}
              onClick={() => onSelect(new Date(d))}
              style={{
                aspectRatio: "1 / 1",
                background: bg,
                border: "none",
                borderRadius: 6,
                color: textColor,
                fontSize: 11.5,
                fontWeight: isSelected ? 700 : isToday ? 600 : 500,
                cursor: "pointer",
                position: "relative",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = bg; }}
            >
              {d.getDate()}
              {hasMark && (
                <span style={{
                  position: "absolute",
                  bottom: 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%",
                  background: isSelected ? "var(--bg-base)" : "var(--accent)",
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <button
        onClick={() => onSelect(new Date())}
        style={{
          marginTop: 12, width: "100%", padding: "7px 10px",
          background: "transparent", border: "1px solid var(--border-2)", borderRadius: 7,
          color: "var(--text-muted-2)", fontSize: 11.5, cursor: "pointer",
        }}
      >
        Jump to today
      </button>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-2)",
  borderRadius: 6,
  padding: "4px 6px",
  cursor: "pointer",
};
