"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, Calendar, BarChart2 } from "lucide-react";
import Sidebar           from "@/components/Sidebar";
import AnalyticsTab      from "@/components/AnalyticsTab";
import CallsTab          from "@/components/CallsTab";
import CalendarTab       from "@/components/CalendarTab";
import ContactSearch     from "@/components/ContactSearch";
import AccountModal      from "@/components/AccountModal";
import NotificationTray  from "@/components/NotificationTray";
import { Client }    from "@/lib/data";

type Tab = "analytics" | "calls" | "calendar";

export interface CurrentAdmin { id: string; email: string; name: string | null; role: string; }

export default function Page() {
  const router = useRouter();
  const [admin,         setAdmin]         = useState<CurrentAdmin | null>(null);
  const [authChecked,   setAuthChecked]   = useState(false);
  const [clients,       setClients]       = useState<Client[]>([]);
  const [activeClient,  setActiveClient]  = useState<Client | null>(null);
  const [activeTab,     setActiveTab]     = useState<Tab>("analytics");
  const [collapsed,     setCollapsed]     = useState(false);
  const [showAccount,   setShowAccount]   = useState(false);

  // Gate: check session, redirect to /login if not authenticated
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async r => {
        if (!r.ok) { router.replace("/login"); return null; }
        return r.json();
      })
      .then(data => {
        if (data?.admin) {
          setAdmin(data.admin);
          setAuthChecked(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  function loadClients() {
    return fetch("/api/clients")
      .then(r => r.json())
      .then(data => {
        const list: Client[] = data.clients || [];
        setClients(list);
        setActiveClient(prev => {
          // Keep current selection if it still exists; otherwise pick first.
          if (prev && list.some(c => c.id === prev.id)) return prev;
          return list[0] || null;
        });
      })
      .catch(() => {});
  }

  useEffect(() => { if (authChecked) loadClients(); }, [authChecked]);

  const tabs: { id: Tab; label: string; icon: typeof BarChart2 }[] = [
    { id: "analytics",  label: "Analytics", icon: BarChart2 },
    { id: "calls",      label: "Call Log",  icon: Phone     },
    { id: "calendar",   label: "Calendar",  icon: Calendar  },
  ];

  if (!authChecked || !activeClient) {
    return (
      <div style={{ fontFamily: "var(--font-sans)", background: "var(--bg-base)", color: "var(--text-dim)", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
        {!authChecked ? "Authenticating…" : "Connecting to server…"}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: "var(--bg-base)", color: "var(--text-primary)", height: "100vh", display: "flex", fontSize: 13, overflow: "hidden" }}>
      <Sidebar
        clients={clients}
        activeClient={activeClient}
        setActiveClient={setActiveClient}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        refreshClients={loadClients}
        admin={admin}
        onOpenAccount={() => setShowAccount(true)}
        onSignOut={signOut}
      />

      {showAccount && admin && (
        <AccountModal admin={admin} onClose={() => setShowAccount(false)} onPasswordChanged={() => {}} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-strong)" }}>{activeClient.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>Agent: {activeClient.agentName} · {activeClient.city}</div>
          </div>

          <ContactSearch clientId={activeClient.id} />

          <NotificationTray clientId={activeClient.id} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 20 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>Live</span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", display: "flex", gap: 2, overflowX: "auto", flexShrink: 0 }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24, background: "var(--bg-base)" }}>
          {activeTab === "analytics"  && <AnalyticsTab  client={activeClient} />}
          {activeTab === "calls"      && <CallsTab      clientId={activeClient.id} />}
          {activeTab === "calendar"   && <CalendarTab   clientId={activeClient.id} />}
        </div>
      </div>
    </div>
  );
}
