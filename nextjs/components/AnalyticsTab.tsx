"use client";
import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PhoneCall, CheckCircle, Activity, Clock, PhoneMissed, Mic, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Client, Call } from "@/lib/data";

const TOOL_COLORS: Record<string, string> = {
  book_appointment:       "var(--accent)",
  check_availability:     "#3b82f6",
  get_appointment:        "#a78bfa",
  reschedule_appointment: "#f59e0b",
  cancel_appointment:     "#ef4444",
};
const FALLBACK_COLORS = ["var(--text-muted)", "#334155", "#475569"];

interface Analytics {
  summary: { total: number; booked: number; missed: number; bookingRate: number; avgDurationFmt: string };
  toolDistribution: { tool: string; count: number; pct: number }[];
  hourly: { hour: string; calls: number; booked: number; missed: number }[];
}

export default function AnalyticsTab({ client }: { client: Client }) {
  const [today, setToday]   = useState<Analytics | null>(null);
  const [weekly, setWeekly] = useState<Analytics | null>(null);
  const [calls,  setCalls]  = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/retell/analytics?clientId=${client.id}&period=today`).then(r => r.json()),
      fetch(`/api/retell/analytics?clientId=${client.id}&period=week`).then(r => r.json()),
      fetch(`/api/retell/calls?clientId=${client.id}&limit=5`).then(r => r.json()),
    ])
      .then(([t, w, c]) => {
        setToday(t);
        setWeekly(w);
        setCalls(c.calls || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [client.id]);

  const s = today?.summary;

  const stats = [
    { label: "Calls (24h)",       value: s ? String(s.total)           : "–", delta: "",     up: true,  icon: PhoneCall,   color: "var(--accent)" },
    { label: "Bookings Made",     value: s ? String(s.booked)          : "–", delta: "",     up: true,  icon: CheckCircle, color: "#3b82f6" },
    { label: "Booking Rate",      value: s ? `${s.bookingRate}%`       : "–", delta: "",     up: true,  icon: Activity,    color: "#a78bfa" },
    { label: "Avg Call Duration", value: s ? s.avgDurationFmt          : "–", delta: "",     up: false, icon: Clock,       color: "#f59e0b" },
    { label: "Missed / Failed",   value: s ? String(s.missed)          : "–", delta: "",     up: true,  icon: PhoneMissed, color: "#ef4444" },
    { label: "Active Agent",      value: client.agentName || "–",              delta: "Live", up: true,  icon: Mic,         color: "var(--accent)" },
  ];

  const toolDist = (today?.toolDistribution || []).map((t, i) => ({
    name:  t.tool,
    value: t.pct,
    color: TOOL_COLORS[t.tool] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  const statusColor = (s: string) => s === "missed" ? "#ef4444" : "var(--accent)";

  if (loading) {
    return <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 20 }}>Loading analytics…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-strong)", letterSpacing: "-0.5px" }}>{s.value}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={15} color={s.color} />
              </div>
            </div>
            {s.delta && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
                {s.up ? <ArrowUpRight size={12} color="var(--accent)" /> : <ArrowDownRight size={12} color="#ef4444" />}
                <span style={{ fontSize: 11, color: s.up ? "var(--accent)" : "#ef4444", fontWeight: 500 }}>{s.delta}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Calls — Past 24 Hours</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={today?.hourly || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gc1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gc2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour"  tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--border)", border: "1px solid var(--border-3)", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="calls"  stroke="var(--accent)" strokeWidth={2} fill="url(#gc1)" name="Calls" />
              <Area type="monotone" dataKey="booked" stroke="#3b82f6" strokeWidth={2} fill="url(#gc2)" name="Booked" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Calls — Past 7 Days</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekly?.hourly || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="hour"  tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--border)", border: "1px solid var(--border-3)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="calls"  fill="var(--border-2)" radius={[4,4,0,0]} name="Calls" />
              <Bar dataKey="booked" fill="var(--accent)" radius={[4,4,0,0]} name="Booked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tool dist + recent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 16 }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Tool Distribution</div>
          {toolDist.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <PieChart width={120} height={120}>
                <Pie data={toolDist} cx={55} cy={55} innerRadius={36} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {toolDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {toolDist.map(t => (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{t.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginLeft: "auto" }}>{t.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: 12, padding: "20px 0" }}>No tool data yet.</div>
          )}
        </div>

        <div className="stat-card">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Recent Activity</div>
          {calls.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No recent calls.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {calls.slice(0, 5).map(call => (
                <div key={call.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: call.status === "missed" ? "rgba(239,68,68,0.1)" : "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PhoneCall size={13} color={statusColor(call.status)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-bright)", fontFamily: "var(--font-mono)" }}>{call.caller}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{call.outcome || "–"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {call.startedAt ? new Date(call.startedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "–"}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{call.duration}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
