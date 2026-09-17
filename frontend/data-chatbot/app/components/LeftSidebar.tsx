"use client";

import React from "react";
import DataExplorer from "@/app/components/DataExplorer";
import SessionPanel from "@/app/components/SessionPanel";
import type { SchemaClient } from "@/app/lib/schemaClient";
import type { ChatSession } from "@/app/types";

export interface LeftSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  schemaClient?: SchemaClient | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  isMobile: boolean;
}

export default function LeftSidebar({
  isOpen, onClose, schemaClient, sessions,
  activeSessionId, onSelectSession, onNewChat, isMobile,
}: LeftSidebarProps) {
  if (isMobile && !isOpen) return null;

  const sidebar = (
    <aside data-testid="left-sidebar" style={{
      width: isMobile ? 280 : 260,
      height: isMobile ? "100vh" : "100%",
      display: "flex", flexDirection: "column",
      backgroundColor: "var(--surface-sidebar)",
      color: "var(--text-on-dark)",
      overflow: "hidden",
      position: isMobile ? "fixed" : "relative",
      top: isMobile ? 0 : undefined, left: isMobile ? 0 : undefined,
      zIndex: isMobile ? 1100 : undefined, boxSizing: "border-box",
    }}>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {schemaClient ? (
          <DataExplorer schemaClient={schemaClient} />
        ) : (
          <div style={{ padding: "16px 16px" }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: 1.2, color: "var(--text-on-dark-muted)", marginBottom: 10,
            }}>Databases</div>
            <div style={{ fontSize: 12.5, color: "var(--text-on-dark-muted)" }}>
              Schema discovery not configured
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 1, background: "var(--border-subtle)", flexShrink: 0 }} />
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <SessionPanel sessions={sessions} activeSessionId={activeSessionId}
          onSelectSession={onSelectSession} onNewChat={onNewChat} />
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <div data-testid="sidebar-backdrop" onClick={onClose} style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050,
          backdropFilter: "blur(2px)",
        }} />
        {sidebar}
      </>
    );
  }
  return sidebar;
}
