"use client";
import { useState } from "react";
import { Building2, Zap, User, LogOut, Plus, ChevronLeft, Trash2 } from "lucide-react";
import { Client } from "@/lib/data";
import AddClientModal from "./AddClientModal";

interface AdminLite { id: string; email: string; name: string | null; role: string }
interface Props {
  clients: Client[];
  activeClient: Client;
  setActiveClient: (c: Client) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  refreshClients: () => void;
  admin: AdminLite | null;
  onOpenAccount: () => void;
  onSignOut: () => void;
}

export default function Sidebar({ clients, activeClient, setActiveClient, collapsed, setCollapsed, refreshClients, admin, onOpenAccount, onSignOut }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const statusColor = (s: string) =>
    s === "active" ? "var(--accent)" : s === "warning" ? "#f59e0b" : "var(--text-faint)";

  async function deleteClient(e: React.MouseEvent, c: Client) {
    e.stopPropagation();
    if (!confirm(`Delete client "${c.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    if (res.ok) refreshClients();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Failed to delete client.");
    }
  }

  return (
    <div style={{
      width: collapsed ? 56 : 220, flexShrink: 0,
      background: "var(--bg-surface)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", transition: "width 0.2s",
      overflow: "visible", position: "relative",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,var(--accent),#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Zap size={14} color="var(--bg-base)" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px", color: "var(--text-strong)" }}>
            FlowDesk
          </span>
        )}
      </div>

      {/* Clients */}
      {!collapsed && (
        <div style={{ padding: "14px 12px 6px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 4px 8px" }}>
            Clients
          </div>
          {clients.map(c => (
            <div
              key={c.id}
              className={`client-row ${activeClient.id === c.id ? "active" : ""}`}
              onClick={() => setActiveClient(c)}
              style={{ position: "relative" }}
              onMouseEnter={e => { const btn = e.currentTarget.querySelector<HTMLButtonElement>(".client-del"); if (btn) btn.style.opacity = "1"; }}
              onMouseLeave={e => { const btn = e.currentTarget.querySelector<HTMLButtonElement>(".client-del"); if (btn) btn.style.opacity = "0"; }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Building2 size={13} color={activeClient.id === c.id ? "var(--accent)" : "var(--text-faint)"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: activeClient.id === c.id ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{c.city}</div>
              </div>
              <button
                className="client-del"
                onClick={(e) => deleteClient(e, c)}
                title="Delete client"
                style={{ opacity: 0, transition: "opacity 0.15s", background: "none", border: "none", padding: 4, cursor: "pointer", flexShrink: 0 }}
              >
                <Trash2 size={12} color="#ef4444" />
              </button>
              <div className="pulse" style={{ background: statusColor(c.status), boxShadow: c.status === "active" ? "0 0 5px var(--accent-border)" : "none" }} />
            </div>
          ))}
          <button
            className="client-row"
            onClick={() => setShowAdd(true)}
            style={{ width: "100%", border: "1px dashed var(--border-2)", color: "var(--text-dim)", marginTop: 6, background: "none", cursor: "pointer" }}
          >
            <Plus size={13} />
            <span style={{ fontSize: 12 }}>Add Client</span>
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Bottom nav */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        {!collapsed && admin && (
          <div style={{ padding: "4px 8px 6px", fontSize: 10.5, color: "var(--text-muted-2)" }}>
            <div style={{ color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {admin.name || admin.email}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
              {admin.role}
            </div>
          </div>
        )}
        <button onClick={onOpenAccount} className="tab-btn" style={{ width: "100%", justifyContent: collapsed ? "center" : "flex-start", color: "var(--text-faint)" }}>
          <User size={14} />
          {!collapsed && "Account"}
        </button>
        <button onClick={onSignOut} className="tab-btn" style={{ width: "100%", justifyContent: collapsed ? "center" : "flex-start", color: "#ef4444" }}>
          <LogOut size={14} />
          {!collapsed && "Sign out"}
        </button>
      </div>

      {/* Collapse toggle — sticks out from the right edge so it's always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute", right: -12, top: 20,
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--bg-card)", border: "1px solid var(--border-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 10,
          boxShadow: "var(--shadow-card)",
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--accent-dim)";
          e.currentTarget.style.borderColor = "var(--accent-border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-card)";
          e.currentTarget.style.borderColor = "var(--border-3)";
        }}
      >
        <ChevronLeft
          size={13}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
          }}
        />
      </button>

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreated={refreshClients} />}
    </div>
  );
}
