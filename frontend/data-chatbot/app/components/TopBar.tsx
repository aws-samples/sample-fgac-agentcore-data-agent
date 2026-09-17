"use client";

import React, { useState, useRef, useEffect } from "react";
import { signOut } from "aws-amplify/auth";
import DataAgentLogo from "@/app/components/DataAgentLogo";
import type { AuthUser } from "@/app/types";

export interface TopBarProps {
  user: AuthUser;
  onMenuToggle: () => void;
  isMobile: boolean;
}

export default function TopBar({ user, onMenuToggle, isMobile }: TopBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [drawerOpen]);

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <header data-testid="topbar" style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: 52,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", backgroundColor: "var(--surface-dark)",
      color: "var(--text-on-dark)", zIndex: 1000, boxSizing: "border-box",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      {/* Left: Brand */}
      <div data-testid="brand-banner" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <button data-testid="hamburger-menu" onClick={onMenuToggle} aria-label="Toggle sidebar"
            style={{ background: "none", border: "none", color: "var(--text-on-dark)",
              fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1, marginRight: 2 }}>
            ☰
          </button>
        )}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}><DataAgentLogo size={30} /></div>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.3 }}>
          FGAC Data Agent
        </span>
      </div>

      {/* Right: Account */}
      <div data-testid="account-panel" ref={drawerRef} style={{ position: "relative" }}>
        <button data-testid="account-toggle" onClick={() => setDrawerOpen(p => !p)} style={{
          display: "flex", alignItems: "center", gap: 8,
          background: drawerOpen ? "var(--surface-dark-active)" : "transparent",
          border: "1px solid var(--border-subtle)", borderRadius: 10,
          padding: "5px 12px 5px 5px", color: "var(--text-on-dark)",
          cursor: "pointer", fontSize: 13, transition: "background 0.15s",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>{initials}</span>
          <span style={{ fontWeight: 500 }}>{user.username}</span>
          {user.team && (
            <span style={{
              background: "rgba(37,99,235,0.2)", color: "#93c5fd",
              padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}>{user.team}</span>
          )}
        </button>

        {drawerOpen && (
          <div data-testid="account-drawer" style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 260,
            backgroundColor: "var(--surface-card)", color: "var(--text-primary)",
            borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
            overflow: "hidden", animation: "slideDown 0.15s ease-out", zIndex: 1100,
            border: "1px solid var(--border-light)",
          }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: "#fff",
              }}>{initials}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{user.email}</div>
              </div>
            </div>
            <div style={{ padding: "12px 18px", fontSize: 13 }}>
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 500, minWidth: 40 }}>Sub</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", wordBreak: "break-all" }}>{user.sub}</span>
              </div>
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 500, minWidth: 40 }}>Team</span>
                <span style={{
                  background: "var(--accent-soft)", color: "var(--accent)",
                  padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                }}>{user.team || "—"}</span>
              </div>
              {Object.entries(user.customAttributes)
                .filter(([key]) => key !== "custom:team")
                .map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 6, display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 500, minWidth: 40 }}>
                      {key.replace("custom:", "")}</span>
                    <span>{value}</span>
                  </div>
                ))}
            </div>
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border-light)" }}>
              <button data-testid="logout-button" onClick={async () => { try { await signOut(); } catch {} }}
                style={{
                  width: "100%", padding: "8px 0", fontSize: 13, fontWeight: 600,
                  color: "var(--error)", backgroundColor: "transparent",
                  border: "1px solid #fecaca", borderRadius: "var(--radius-sm)",
                  cursor: "pointer", transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--error-soft)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >Sign Out</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
