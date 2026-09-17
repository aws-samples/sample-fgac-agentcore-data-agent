"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { DatabaseNode } from "@/app/types";
import type { SchemaClient } from "@/app/lib/schemaClient";
import { useNotifications } from "@/app/components/NotificationProvider";

export interface DataExplorerProps {
  schemaClient: SchemaClient;
}

export default function DataExplorer({ schemaClient }: DataExplorerProps) {
  const [databases, setDatabases] = useState<DatabaseNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const { addNotification } = useNotifications();

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    try {
      const result = await schemaClient.fetchSchema();
      setDatabases(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load schema";
      addNotification({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [schemaClient, addNotification]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const toggleDatabase = (dbName: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(dbName)) {
        next.delete(dbName);
      } else {
        next.add(dbName);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    setDatabases([]);
    setExpandedDbs(new Set());
    fetchSchema();
  };

  return (
    <div data-testid="data-explorer" style={{ padding: "8px 0" }}>
      {/* Header with refresh button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px 8px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", opacity: 0.7 }}>
          Databases
        </span>
        <button
          data-testid="refresh-button"
          onClick={handleRefresh}
          aria-label="Refresh schema"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            padding: "2px 6px",
            borderRadius: 4,
            color: "inherit",
            opacity: 0.7,
          }}
        >
          ↻
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          data-testid="schema-loading"
          style={{ padding: "12px", fontSize: 13, opacity: 0.6, textAlign: "center" }}
        >
          Loading schema…
        </div>
      )}

      {/* Database tree */}
      {!loading && databases.length === 0 && (
        <div style={{ padding: "12px", fontSize: 13, opacity: 0.5, textAlign: "center" }}>
          No databases found
        </div>
      )}

      {!loading &&
        databases.map((db) => {
          const isExpanded = expandedDbs.has(db.name);
          return (
            <div key={db.name}>
              <button
                data-testid={`db-node-${db.name}`}
                onClick={() => toggleDatabase(db.name)}
                aria-expanded={isExpanded}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  padding: "6px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 10, width: 12, textAlign: "center" }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span>🗄️</span>
                <span>{db.name}</span>
                <span style={{ opacity: 0.5, fontSize: 11, marginLeft: "auto" }}>
                  {db.tables.length}
                </span>
              </button>

              {isExpanded &&
                db.tables.map((table) => (
                  <div
                    key={`${db.name}-${table}`}
                    data-testid={`table-${db.name}-${table}`}
                    style={{
                      padding: "4px 12px 4px 40px",
                      fontSize: 12,
                      opacity: 0.85,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>📋</span>
                    <span>{table}</span>
                  </div>
                ))}
            </div>
          );
        })}
    </div>
  );
}
