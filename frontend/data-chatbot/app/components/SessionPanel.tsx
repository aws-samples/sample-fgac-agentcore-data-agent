"use client";

import React from "react";
import type { ChatSession } from "@/app/types";

export interface SessionPanelProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

export default function SessionPanel({
  sessions, activeSessionId, onSelectSession, onNewChat,
}: SessionPanelProps) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div data-testid="session-panel" style={{ padding: "12px 0" }}>
      <div style={{
        padding: "0 12px 4px", fontSize: 10, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: 1.2,
        color: "var(--text-on-dark-muted)",
      }}>Chat History</div>
      <div style={{ padding: "6px 12px 10px" }}>
        <button data-testid="new-chat-button" onClick={onNewChat} style={{
          width: "100%", padding: "8px 12px",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
          cursor: "pointer", fontSize: 12.5, fontWeight: 600,
          transition: "opacity 0.15s", letterSpacing: 0.2,
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >+ New Chat</button>
      </div>
      {sorted.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <button key={session.id} data-testid={`session-entry-${session.id}`}
            onClick={() => onSelectSession(session.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "9px 12px 9px 14px",
              background: isActive ? "var(--surface-dark-active)" : "transparent",
              border: "none",
              borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer", fontSize: 12.5,
              color: isActive ? "var(--text-on-dark)" : "var(--text-on-dark-muted)",
              textAlign: "left", fontWeight: isActive ? 600 : 400,
              transition: "all 0.12s", fontFamily: "inherit",
              borderRadius: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = "var(--surface-dark-hover)";
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ fontSize: 13, opacity: 0.4 }}>💬</span>
            <span style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{session.label}</span>
          </button>
        );
      })}
    </div>
  );
}
