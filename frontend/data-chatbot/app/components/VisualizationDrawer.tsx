"use client";

import React from "react";
import type { StructuredData } from "@/app/types";

export interface VisualizationDrawerProps {
  isOpen: boolean;
  data: StructuredData | null;
  onClose: () => void;
  isMobile: boolean;
}

export default function VisualizationDrawer({
  isOpen, data, onClose, isMobile,
}: VisualizationDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {isMobile && (
        <div data-testid="drawer-backdrop" onClick={onClose} style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050,
          backdropFilter: "blur(2px)",
        }} />
      )}
      <aside data-testid="visualization-drawer" style={{
        width: isMobile ? "100vw" : 420,
        height: isMobile ? "100vh" : "100%",
        position: isMobile ? "fixed" : "relative",
        top: isMobile ? 0 : undefined, right: isMobile ? 0 : undefined,
        zIndex: isMobile ? 1100 : undefined,
        display: "flex", flexDirection: "column",
        backgroundColor: "var(--surface-card)",
        borderLeft: isMobile ? "none" : "1px solid var(--border-light)",
        boxSizing: "border-box", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid var(--border-light)", flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.2 }}>📊 Data View</span>
          <button data-testid="drawer-close-button" onClick={onClose} style={{
            background: "var(--surface-input)", border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-sm)", padding: "5px 12px",
            cursor: "pointer", fontSize: 12.5, fontWeight: 500,
            color: "var(--text-secondary)", transition: "all 0.15s", fontFamily: "inherit",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--border-light)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-input)")}
          >Close</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {data ? (
            <table data-testid="drawer-table" style={{
              width: "100%", borderCollapse: "separate", borderSpacing: 0,
              fontSize: 13, borderRadius: "var(--radius-md)", overflow: "hidden",
              border: "1px solid var(--border-light)",
            }}>
              <thead>
                <tr>
                  {data.columns.map(col => (
                    <th key={col} style={{
                      textAlign: "left", padding: "10px 14px",
                      borderBottom: "1px solid var(--border-light)",
                      fontWeight: 600, whiteSpace: "nowrap",
                      background: "#f1f5f9", color: "#334155",
                      fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={idx}>
                    {data.columns.map(col => (
                      <td key={col} style={{
                        padding: "8px 14px",
                        borderBottom: "1px solid var(--border-light)",
                        background: idx % 2 === 0 ? "#fff" : "#f8fafc",
                        fontVariantNumeric: "tabular-nums",
                      }}>{row[col] != null ? String(row[col]) : ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              color: "var(--text-muted)", textAlign: "center",
              marginTop: 60, fontSize: 14,
            }}>No data to display</div>
          )}
    
        </div>
      </aside>
    </>
  );
}
